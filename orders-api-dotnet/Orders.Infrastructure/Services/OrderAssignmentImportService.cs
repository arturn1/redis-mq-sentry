using System.Data;
using System.Globalization;
using ClosedXML.Excel;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Orders.Application.Abstractions;
using Orders.Application.DTOs;
using Orders.Domain.Entities;
using Orders.Infrastructure.Persistence;

namespace Orders.Infrastructure.Services;

public class OrderAssignmentImportService : IOrderAssignmentImportService
{
    private const int BulkBatchSize = 5000;
    private readonly OrdersDbContext _dbContext;

    public OrderAssignmentImportService(OrdersDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<OrderAssignmentImportJobResponse> EnqueueAsync(string fileName, byte[] fileContent, CancellationToken cancellationToken)
    {
        if (fileContent.Length == 0)
        {
            throw new InvalidOperationException("Uploaded file is empty.");
        }

        var now = DateTime.UtcNow;
        var job = new OrderAssignmentImportJob
        {
            Id = Guid.NewGuid(),
            FileName = string.IsNullOrWhiteSpace(fileName) ? "assignments.xlsx" : fileName.Trim(),
            FileContent = fileContent,
            Status = OrderAssignmentImportStatus.Pending,
            CreatedAtUtc = now,
        };

        _dbContext.OrderAssignmentImportJobs.Add(job);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return ToResponse(job);
    }

    public async Task<OrderAssignmentImportJobResponse?> GetByIdAsync(Guid jobId, CancellationToken cancellationToken)
    {
        var job = await _dbContext.OrderAssignmentImportJobs
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == jobId, cancellationToken);

        return job == null ? null : ToResponse(job);
    }

    public async Task<IReadOnlyList<OrderAssignmentImportJobResponse>> ListRecentAsync(int take, CancellationToken cancellationToken)
    {
        if (take < 1)
        {
            take = 1;
        }

        if (take > 100)
        {
            take = 100;
        }

        var jobs = await _dbContext.OrderAssignmentImportJobs
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(take)
            .ToListAsync(cancellationToken);

        return jobs.Select(ToResponse).ToList();
    }

    public async Task<OrderAssignmentTemplateFileResponse> BuildTemplateAsync(CancellationToken cancellationToken)
    {
        var orders = await _dbContext.Orders
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new { x.Id, x.CustomerName, x.TotalAmount })
            .ToListAsync(cancellationToken);

        var assignmentRows = await _dbContext.OrderAssignments
            .AsNoTracking()
            .Select(assignment => new { assignment.UserKey, assignment.OrderId, assignment.AssignedValue })
            .ToListAsync(cancellationToken);

        var customers = orders
            .Select(x => x.CustomerName)
            .Concat(assignmentRows.Select(x => x.UserKey))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
            .ToList();

        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Assignments");
        sheet.Cell(1, 1).Value = "OrderId";

        var customerColumn = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < customers.Count; i++)
        {
            var col = i + 2;
            var customerName = customers[i];
            customerColumn[customerName] = col;
            sheet.Cell(1, col).Value = customerName;
        }

        for (var i = 0; i < orders.Count; i++)
        {
            var row = i + 2;
            var order = orders[i];
            sheet.Cell(row, 1).Value = order.Id.ToString();

            var hasAssignment = false;
            foreach (var assignment in assignmentRows.Where(x => x.OrderId == order.Id))
            {
                if (!customerColumn.TryGetValue(assignment.UserKey, out var mappedCol))
                {
                    continue;
                }

                sheet.Cell(row, mappedCol).Value = assignment.AssignedValue;
                hasAssignment = true;
            }

            // Backward-compatible fallback: if no relational assignment exists yet,
            // expose current Order total on its customer column.
            if (hasAssignment)
            {
                continue;
            }

            if (customerColumn.TryGetValue(order.CustomerName, out var col))
            {
                sheet.Cell(row, col).Value = order.TotalAmount;
            }
        }

        sheet.Row(1).Style.Font.Bold = true;
        sheet.SheetView.FreezeRows(1);
        sheet.SheetView.FreezeColumns(1);
        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var fileName = $"order-assignments-template-{DateTime.UtcNow:yyyyMMddHHmmss}.xlsx";
        return new OrderAssignmentTemplateFileResponse(
            fileName,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            stream.ToArray());
    }

    public async Task ProcessPendingAsync(CancellationToken cancellationToken)
    {
        var job = await _dbContext.OrderAssignmentImportJobs
            .OrderBy(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(x => x.Status == OrderAssignmentImportStatus.Pending, cancellationToken);

        if (job == null)
        {
            return;
        }

        job.Status = OrderAssignmentImportStatus.Processing;
        job.StartedAtUtc = DateTime.UtcNow;
        job.LastError = null;
        await _dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            await _dbContext.OrderAssignmentImportRows
                .Where(x => x.JobId == job.Id)
                .ExecuteDeleteAsync(cancellationToken);

            var parseResult = await ParseAndStageRowsAsync(job, cancellationToken);
            var mergeResult = await MergeIntoAssignmentsAsync(job.Id, cancellationToken);

            job.TotalCellsRead = parseResult.TotalCells;
            job.ValidCells = parseResult.ValidCells;
            job.InvalidCells = parseResult.InvalidCells;
            job.InsertedCount = mergeResult.InsertedCount;
            job.UpdatedCount = mergeResult.UpdatedCount;
            job.Status = OrderAssignmentImportStatus.Completed;
            job.CompletedAtUtc = DateTime.UtcNow;
            job.LastError = null;
            job.FileContent = Array.Empty<byte>();

            await _dbContext.OrderAssignmentImportRows
                .Where(x => x.JobId == job.Id)
                .ExecuteDeleteAsync(cancellationToken);

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            job.Status = OrderAssignmentImportStatus.Failed;
            job.LastError = ex.Message;
            job.CompletedAtUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<(int TotalCells, int ValidCells, int InvalidCells)> ParseAndStageRowsAsync(
        OrderAssignmentImportJob job,
        CancellationToken cancellationToken)
    {
        using var stream = new MemoryStream(job.FileContent, writable: false);
        using var workbook = new XLWorkbook(stream);
        var sheet = workbook.Worksheets.FirstOrDefault();

        if (sheet == null)
        {
            throw new InvalidOperationException("Excel file does not have any worksheet.");
        }

        var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 0;
        var lastCol = sheet.LastColumnUsed()?.ColumnNumber() ?? 0;
        if (lastRow < 2 || lastCol < 2)
        {
            throw new InvalidOperationException("Excel matrix must include header row and at least one data row.");
        }

        var customerByColumn = new Dictionary<int, string>();
        var headerCustomers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var col = 2; col <= lastCol; col++)
        {
            var customerName = sheet.Cell(1, col).GetString().Trim();
            if (string.IsNullOrWhiteSpace(customerName))
            {
                continue;
            }

            customerByColumn[col] = customerName;
            headerCustomers.Add(customerName);
        }

        var existingOrders = await _dbContext.Orders
            .AsNoTracking()
            .Select(x => new { x.Id, x.CustomerName })
            .ToListAsync(cancellationToken);

        var existingOrderIds = existingOrders.Select(x => x.Id).ToHashSet();

        var buffer = new List<OrderAssignmentImportRow>(BulkBatchSize);
        var totalCells = 0;
        var validCells = 0;
        var invalidCells = 0;

        for (var row = 2; row <= lastRow; row++)
        {
            var rawOrderId = sheet.Cell(row, 1).GetString().Trim();
            var hasOrderId = Guid.TryParse(rawOrderId, out var orderId);

            for (var col = 2; col <= lastCol; col++)
            {
                var cell = sheet.Cell(row, col);
                if (cell.IsEmpty())
                {
                    continue;
                }

                totalCells++;

                if (!hasOrderId || !existingOrderIds.Contains(orderId))
                {
                    invalidCells++;
                    continue;
                }

                if (!customerByColumn.TryGetValue(col, out var customerName)
                    || string.IsNullOrWhiteSpace(customerName))
                {
                    invalidCells++;
                    continue;
                }

                if (!TryParseDecimalCell(cell, out var value) || value < 0)
                {
                    invalidCells++;
                    continue;
                }

                validCells++;
                buffer.Add(new OrderAssignmentImportRow
                {
                    JobId = job.Id,
                    UserKey = customerName,
                    OrderId = orderId,
                    AssignedValue = value,
                });

                if (buffer.Count >= BulkBatchSize)
                {
                    await BulkInsertImportRowsAsync(buffer, cancellationToken);
                    buffer.Clear();
                }
            }
        }

        if (buffer.Count > 0)
        {
            await BulkInsertImportRowsAsync(buffer, cancellationToken);
        }

        return (totalCells, validCells, invalidCells);
    }

    private async Task<(int InsertedCount, int UpdatedCount)> MergeIntoAssignmentsAsync(Guid jobId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var nowParameter = new SqlParameter("@now", now);
        var jobIdParameter = new SqlParameter("@jobId", jobId);

        var updatedCount = await _dbContext.Database.ExecuteSqlRawAsync(
            @"UPDATE target
                SET target.AssignedValue = src.AssignedValue,
                    target.UpdatedAtUtc = @now
                FROM OrderAssignments target
                INNER JOIN OrderAssignmentImportRows src
                    ON src.OrderId = target.OrderId
                   AND src.UserKey = target.UserKey
                            WHERE src.JobId = @jobId
                AND target.AssignedValue <> src.AssignedValue;",
            nowParameter,
            jobIdParameter);

        var insertedCount = await _dbContext.Database.ExecuteSqlRawAsync(
            @"INSERT INTO OrderAssignments (UserKey, OrderId, AssignedValue, UpdatedAtUtc)
                SELECT src.UserKey, src.OrderId, src.AssignedValue, @now
                FROM OrderAssignmentImportRows src
                LEFT JOIN OrderAssignments target
                    ON target.UserKey = src.UserKey
                   AND target.OrderId = src.OrderId
                WHERE src.JobId = @jobId
                  AND target.UserKey IS NULL;",
            nowParameter,
            jobIdParameter);

        // Order total becomes the sum of all customer amounts for that order.
        await _dbContext.Database.ExecuteSqlRawAsync(
            @"UPDATE o
                SET o.TotalAmount = COALESCE(s.SumAmount, 0)
                FROM Orders o
                LEFT JOIN (
                    SELECT OrderId, SUM(AssignedValue) AS SumAmount
                    FROM OrderAssignments
                    GROUP BY OrderId
                ) s
                    ON s.OrderId = o.Id
                WHERE o.TotalAmount <> COALESCE(s.SumAmount, 0);");

        return (insertedCount, updatedCount);
    }

    private async Task BulkInsertImportRowsAsync(List<OrderAssignmentImportRow> rows, CancellationToken cancellationToken)
    {
        if (rows.Count == 0)
        {
            return;
        }

        var connection = (SqlConnection)_dbContext.Database.GetDbConnection();
        var shouldCloseConnection = false;

        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
            shouldCloseConnection = true;
        }

        try
        {
            var table = new DataTable();
            table.Columns.Add("JobId", typeof(Guid));
            table.Columns.Add("UserKey", typeof(string));
            table.Columns.Add("OrderId", typeof(Guid));
            table.Columns.Add("AssignedValue", typeof(decimal));

            foreach (var row in rows)
            {
                table.Rows.Add(row.JobId, row.UserKey, row.OrderId, row.AssignedValue);
            }

            using var bulkCopy = new SqlBulkCopy(connection)
            {
                DestinationTableName = "OrderAssignmentImportRows",
                BatchSize = BulkBatchSize,
            };

            bulkCopy.ColumnMappings.Add("JobId", "JobId");
            bulkCopy.ColumnMappings.Add("UserKey", "UserKey");
            bulkCopy.ColumnMappings.Add("OrderId", "OrderId");
            bulkCopy.ColumnMappings.Add("AssignedValue", "AssignedValue");

            await bulkCopy.WriteToServerAsync(table, cancellationToken);
        }
        finally
        {
            if (shouldCloseConnection)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static bool TryParseDecimalCell(IXLCell cell, out decimal value)
    {
        if (cell.DataType == XLDataType.Number)
        {
            return decimal.TryParse(
                cell.GetDouble().ToString(CultureInfo.InvariantCulture),
                NumberStyles.Number,
                CultureInfo.InvariantCulture,
                out value);
        }

        var raw = cell.GetString().Trim();
        if (decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out value))
        {
            return true;
        }

        return decimal.TryParse(raw, NumberStyles.Number, CultureInfo.GetCultureInfo("pt-BR"), out value);
    }

    private static OrderAssignmentImportJobResponse ToResponse(OrderAssignmentImportJob job)
    {
        return new OrderAssignmentImportJobResponse(
            job.Id,
            job.FileName,
            job.Status.ToString(),
            job.TotalCellsRead,
            job.ValidCells,
            job.InvalidCells,
            job.InsertedCount,
            job.UpdatedCount,
            job.CreatedAtUtc,
            job.StartedAtUtc,
            job.CompletedAtUtc,
            job.LastError);
    }
}
