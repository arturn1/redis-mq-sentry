using Orders.Domain.Entities;

namespace Orders.Application.Abstractions;

/// <summary>
/// Abstraction for order publishing across different backends (RabbitMQ, Redis, etc)
/// Used by workflow and dispatcher services to decouple from specific messaging implementation
/// </summary>
public interface IOrderPublisher
{
    /// <summary>
    /// Publish an order asynchronously
    /// </summary>
    Task PublishAsync(Order order, CancellationToken cancellationToken);
}
