namespace Orders.Application.DTOs;

public record OrderAssignmentImportJobResponse(
    Guid JobId,
    string FileName,
    string Status,
    int TotalCellsRead,
    int ValidCells,
    int InvalidCells,
    int InsertedCount,
    int UpdatedCount,
    DateTime CreatedAtUtc,
    DateTime? StartedAtUtc,
    DateTime? CompletedAtUtc,
    string? LastError);
