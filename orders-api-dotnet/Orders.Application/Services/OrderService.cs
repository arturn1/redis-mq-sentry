using Orders.Application.Abstractions;
using Orders.Application.DTOs;
using Orders.Domain.Entities;

namespace Orders.Application.Services;


public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IFastQueuePublisher _fastQueuePublisher;
    private readonly IRabbitQueuePublisher _rabbitQueuePublisher;

    public OrderService(
        IOrderRepository orderRepository,
        ISlowQueuePublisher slowQueuePublisher,
        IFastQueuePublisher fastQueuePublisher,
        IRabbitQueuePublisher rabbitQueuePublisher)
    {
        _orderRepository = orderRepository;
        _fastQueuePublisher = fastQueuePublisher;
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
            Status = OrderStatus.Created
        };

        bool published = false;
        try
        {
            await _fastQueuePublisher.PublishAsync(order, cancellationToken);
            order.Status = OrderStatus.Enqueued;
            published = true;
        }
        catch (Exception ex)
        {
            // Log warning: Redis indisponível, fallback para RabbitMQ
            try
            {
                await _rabbitQueuePublisher.PublishAsync(order, cancellationToken);
                order.Status = OrderStatus.EnqueuedFallbackRabbit;
                published = true;
            }
            catch (Exception rabbitEx)
            {
                order.Status = OrderStatus.EnqueueFailed;
                // Log error: Falha em ambos Redis e RabbitMQ
                throw new Exception("Falha ao enfileirar no Redis e RabbitMQ", new AggregateException(ex, rabbitEx));
            }
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

    public async Task<(IReadOnlyCollection<OrderResponse> Orders, int Total)> ListPagedAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var (orders, total) = await _orderRepository.ListPagedAsync(page, pageSize, cancellationToken);

        return (orders.OrderByDescending(x => x.CreatedAtUtc).Select(ToResponse).ToList(), total);
    }

    private static OrderResponse ToResponse(Order order) =>
        new(order.Id, order.CustomerName, order.TotalAmount, order.Status.ToString(), order.CreatedAtUtc);
}
