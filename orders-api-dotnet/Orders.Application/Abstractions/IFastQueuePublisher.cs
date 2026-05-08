using Orders.Domain.Entities;

namespace Orders.Application.Abstractions;

public interface IFastQueuePublisher
{
    Task PublishAsync(Order order, CancellationToken cancellationToken);
}
