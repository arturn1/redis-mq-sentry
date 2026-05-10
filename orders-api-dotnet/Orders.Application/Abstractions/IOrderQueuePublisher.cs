using Orders.Domain.Entities;

namespace Orders.Application.Abstractions;

public interface IOrderQueuePublisher
{
    Task PublishAsync(Order order, CancellationToken cancellationToken);
}
