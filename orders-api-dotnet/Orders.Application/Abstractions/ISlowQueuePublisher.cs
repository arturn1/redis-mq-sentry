using Orders.Domain.Entities;

namespace Orders.Application.Abstractions;

public interface ISlowQueuePublisher
{
    Task PublishAsync(Order order, CancellationToken cancellationToken);
}
