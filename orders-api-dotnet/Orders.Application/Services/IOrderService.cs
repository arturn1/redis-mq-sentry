using Orders.Application.DTOs;

namespace Orders.Application.Services;

public interface IOrderService
{
    Task<OrderResponse> CreateAsync(CreateOrderRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<OrderResponse>> ListAsync(CancellationToken cancellationToken);
    Task<(IReadOnlyCollection<OrderResponse> Orders, int Total)> ListPagedAsync(int page, int pageSize, CancellationToken cancellationToken);
}
