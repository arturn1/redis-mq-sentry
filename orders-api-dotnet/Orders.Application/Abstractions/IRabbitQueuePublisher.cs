using Orders.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace Orders.Application.Abstractions;

public interface IRabbitQueuePublisher
{
    Task PublishAsync(Order order, CancellationToken cancellationToken);
}
