using Microsoft.AspNetCore.Mvc;
using Orders.Application.Abstractions;
using System.Text.Json;

namespace Orders.Api.Controllers.V2;

[ApiController]
[Route("api/v2/order-assignments/imports")]
public class OrderAssignmentsControllerV2 : ControllerBase
{
    private readonly IOrderAssignmentImportService _importService;

    public OrderAssignmentsControllerV2(IOrderAssignmentImportService importService)
    {
        _importService = importService;
    }

    [HttpPost]
    [RequestFormLimits(MultipartBodyLengthLimit = 50_000_000)]
    [Produces("application/json")]
    public async Task<IActionResult> Upload([FromForm] IFormFile? file, CancellationToken cancellationToken)
    {
        if (file == null)
        {
            return BadRequest(new { message = "File is required." });
        }

        if (file.Length == 0)
        {
            return BadRequest(new { message = "Uploaded file is empty." });
        }

        var extension = Path.GetExtension(file.FileName);
        if (!string.Equals(extension, ".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only .xlsx files are supported." });
        }

        await using var stream = file.OpenReadStream();
        using var memory = new MemoryStream();
        await stream.CopyToAsync(memory, cancellationToken);

        var job = await _importService.EnqueueAsync(file.FileName, memory.ToArray(), cancellationToken);
        return Accepted(new { jobId = job.JobId, status = job.Status, createdAtUtc = job.CreatedAtUtc });
    }

    [HttpGet("{jobId:guid}")]
    [Produces("application/json")]
    public async Task<IActionResult> GetById(Guid jobId, CancellationToken cancellationToken)
    {
        var job = await _importService.GetByIdAsync(jobId, cancellationToken);
        if (job == null)
        {
            return NotFound(new { message = "Import job not found." });
        }

        return Ok(job);
    }

    [HttpGet("template")]
    public async Task<IActionResult> DownloadTemplate(CancellationToken cancellationToken)
    {
        var file = await _importService.BuildTemplateAsync(cancellationToken);
        return File(file.Content, file.ContentType, file.FileName);
    }

    [HttpGet("events")]
    public async Task StreamEvents(CancellationToken cancellationToken)
    {
        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");
        Response.Headers.Append("X-Accel-Buffering", "no");

        string? lastPayload = null;

        while (!cancellationToken.IsCancellationRequested)
        {
            var recentJobs = await _importService.ListRecentAsync(30, cancellationToken);
            var payload = JsonSerializer.Serialize(recentJobs);

            if (!string.Equals(payload, lastPayload, StringComparison.Ordinal))
            {
                await Response.WriteAsync($"event: jobs\ndata: {payload}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
                lastPayload = payload;
            }
            else
            {
                await Response.WriteAsync(": ping\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }

            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
        }
    }
}
