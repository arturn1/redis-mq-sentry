using Orders.Application.Abstractions;
using Orders.Domain.Entities;

namespace Orders.Infrastructure.Messaging;

/// <summary>
/// Redis implementation of IOrderPublisher
/// Used by API v2
/// </summary>
public class RedisOrderPublisher : IOrderPublisher
{
    private readonly IOrderQueuePublisher _redisPublisher;

    public RedisOrderPublisher(IOrderQueuePublisher redisPublisher)
    {
        _redisPublisher = redisPublisher;
    }

    public async Task PublishAsync(Order order, CancellationToken cancellationToken)
    {
        await _redisPublisher.PublishAsync(order, cancellationToken);
    }
}
