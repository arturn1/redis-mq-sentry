using Orders.Application.Abstractions;
using Orders.Application.DTOs;
using Orders.Domain.Entities;

namespace Orders.Application.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly ISlowQueuePublisher _slowQueuePublisher;
    private readonly IFastQueuePublisher _fastQueuePublisher;

    public OrderService(
        IOrderRepository orderRepository,
        ISlowQueuePublisher slowQueuePublisher,
        IFastQueuePublisher fastQueuePublisher)
    {
        _orderRepository = orderRepository;
        _slowQueuePublisher = slowQueuePublisher;
        _fastQueuePublisher = fastQueuePublisher;
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


        try
        {
            await _orderRepository.AddAsync(order, cancellationToken);
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

    public async Task<(IReadOnlyCollection<OrderResponse> Orders, int Total)> ListPagedAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var (orders, total) = await _orderRepository.ListPagedAsync(page, pageSize, cancellationToken);

        PublishFastQueueInBackground(orders.FirstOrDefault());

        return (orders.OrderByDescending(x => x.CreatedAtUtc).Select(ToResponse).ToList(), total);
    }

    private void PublishFastQueueInBackground(Order order)
    {
        if (order == null) _ = PublishFastQueueNoThrowAsync(new Order{ TotalAmount = 0, CustomerName = "N/A" });
        else
        _ = PublishFastQueueNoThrowAsync(order);
    }

    private async Task PublishFastQueueNoThrowAsync(Order order)
    {
        try
        {
            await _fastQueuePublisher.PublishAsync(order, CancellationToken.None);
        }
        catch
        {
            // No fluxo de listagem, falha no redis-fast nao deve bloquear resposta HTTP.
        }
    }

    private static OrderResponse ToResponse(Order order) =>
        new(order.Id, order.CustomerName, order.TotalAmount, order.Status.ToString(), order.CreatedAtUtc);
}
