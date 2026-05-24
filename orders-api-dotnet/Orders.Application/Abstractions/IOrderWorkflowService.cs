using Orders.Application.DTOs;

namespace Orders.Application.Abstractions;

public interface IOrderWorkflowService
{
    Task<OrderResponse> CreateWithOutboxSagaAsync(
        CreateOrderRequest request,
        string backend,
        string contractVersion,
        CancellationToken cancellationToken);

    Task<OrderEventReplayResponse?> ReplayOrderStateAsync(Guid orderId, CancellationToken cancellationToken);
}
