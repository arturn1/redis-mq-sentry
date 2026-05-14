using Orders.Application.Abstractions;
using Orders.Application.DTOs;
using Orders.Domain.Entities;

namespace Orders.Application.Services;

/// <summary>
/// Order business logic service
/// Uses IOrderPublisher abstraction to support different backends (v1→RabbitMQ, v2→Redis)
/// </summary>
public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderPublisher _orderPublisher;

    public OrderService(
        IOrderRepository orderRepository,
        IOrderPublisher orderPublisher)
    {
        _orderRepository = orderRepository;
        _orderPublisher = orderPublisher;
    }

    public async Task<OrderResponse> CreateAsync(CreateOrderRequest request, CancellationToken cancellationToken)
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerName = request.CustomerName,
            TotalAmount = request.TotalAmount,
            CreatedAtUtc = DateTime.UtcNow,
            Status = OrderStatus.Enqueued
        };

        try
        {
            await _orderPublisher.PublishAsync(order, cancellationToken);
        }
        catch (Exception ex)
        {
            throw new Exception("Error publishing order: " + ex.Message, ex);
        }

        return ToResponse(order);
    }


    public async Task<IReadOnlyCollection<OrderResponse>> ListAsync(CancellationToken cancellationToken)
    {
        var orders = await _orderRepository.ListAsync(cancellationToken);
        return orders
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(ToResponse)
            .ToList();
    }

    public async Task<(IReadOnlyCollection<OrderResponse> Orders, int Total)> ListPagedAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var (orders, total) = await _orderRepository.ListPagedAsync(page, pageSize, cancellationToken);

        return (orders.OrderByDescending(x => x.CreatedAtUtc).Select(ToResponse).ToList(), total);
    }

    private static OrderResponse ToResponse(Order order) =>
        new(order.Id, order.CustomerName, order.TotalAmount, order.Status.ToString(), order.CreatedAtUtc);
}
