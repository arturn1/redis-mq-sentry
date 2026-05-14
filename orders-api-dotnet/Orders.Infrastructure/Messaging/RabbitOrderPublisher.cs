using Orders.Application.Abstractions;
using Orders.Domain.Entities;

namespace Orders.Infrastructure.Messaging;

/// <summary>
/// RabbitMQ implementation of IOrderPublisher
/// Used by API v1
/// </summary>
public class RabbitOrderPublisher : IOrderPublisher
{
    private readonly IRabbitQueuePublisher _rabbitPublisher;

    public RabbitOrderPublisher(IRabbitQueuePublisher rabbitPublisher)
    {
        _rabbitPublisher = rabbitPublisher;
    }

    public async Task PublishAsync(Order order, CancellationToken cancellationToken)
    {
        await _rabbitPublisher.PublishAsync(order, cancellationToken);
    }
}
