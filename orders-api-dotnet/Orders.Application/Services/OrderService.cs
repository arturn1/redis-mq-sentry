using Orders.Application.Abstractions;
using Orders.Application.DTOs;
using Orders.Domain.Entities;

namespace Orders.Application.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly ISlowQueuePublisher _slowQueuePublisher;

    public OrderService(IOrderRepository orderRepository, ISlowQueuePublisher slowQueuePublisher)
    {
        _orderRepository = orderRepository;
        _slowQueuePublisher = slowQueuePublisher;
    }

    public async Task<OrderResponse> CreateAsync(CreateOrderRequest request, CancellationToken cancellationToken)
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerName = request.CustomerName,
            TotalAmount = request.TotalAmount,
            CreatedAtUtc = DateTime.UtcNow,
            Status = OrderStatus.Created
        };

        await _orderRepository.AddAsync(order, cancellationToken);

        try
        {
            await _slowQueuePublisher.PublishAsync(order, cancellationToken);
            order.Status = OrderStatus.Enqueued;
        }
        catch
        {
            order.Status = OrderStatus.EnqueueFailed;
            throw;
        }
        finally
        {
            await _orderRepository.SaveChangesAsync(cancellationToken);
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

    private static OrderResponse ToResponse(Order order) =>
        new(order.Id, order.CustomerName, order.TotalAmount, order.Status.ToString(), order.CreatedAtUtc);
}
