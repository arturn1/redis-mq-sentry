using Orders.Application.DTOs;

namespace Orders.Application.Abstractions;

public interface IOrderAssignmentImportService
{
    Task<OrderAssignmentImportJobResponse> EnqueueAsync(string fileName, byte[] fileContent, CancellationToken cancellationToken);
    Task<OrderAssignmentImportJobResponse?> GetByIdAsync(Guid jobId, CancellationToken cancellationToken);
    Task<IReadOnlyList<OrderAssignmentImportJobResponse>> ListRecentAsync(int take, CancellationToken cancellationToken);
    Task<OrderAssignmentTemplateFileResponse> BuildTemplateAsync(CancellationToken cancellationToken);
    Task ProcessPendingAsync(CancellationToken cancellationToken);
}
