using Orders.Application.Abstractions;
using Orders.Application.DTOs;
using Orders.Domain.Entities;

namespace Orders.Application.Services;


public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderQueuePublisher _orderQueuePublisher;
    private readonly IRabbitQueuePublisher _rabbitQueuePublisher;

    public OrderService(
        IOrderRepository orderRepository,
        IOrderQueuePublisher orderQueuePublisher,
        IRabbitQueuePublisher rabbitQueuePublisher)
    {
        _orderRepository = orderRepository;
        _orderQueuePublisher = orderQueuePublisher;
        _rabbitQueuePublisher = rabbitQueuePublisher;
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
            //await _orderQueuePublisher.PublishAsync(order, cancellationToken);
            await _rabbitQueuePublisher.PublishAsync(order, cancellationToken);
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
