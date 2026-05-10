using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Orders.Application.Abstractions;
using Orders.Domain.Entities;
using RabbitMQ.Client;

namespace Orders.Infrastructure.Messaging;

public class RabbitQueuePublisher : IRabbitQueuePublisher
{
    private readonly RabbitMqOptions _options;
    private readonly RabbitConnectionProvider _connectionProvider;

    public RabbitQueuePublisher(IOptions<RabbitMqOptions> options, RabbitConnectionProvider connectionProvider)
    {
        _options = options.Value;
        _connectionProvider = connectionProvider;
    }

    public async Task PublishAsync(Order order, CancellationToken cancellationToken)
    {
        var payload = new
        {
            Id = order.Id,
            CustomerName = order.CustomerName,
            TotalAmount = order.TotalAmount,
            Status = order.Status.ToString(),
            CreatedAtUtc = order.CreatedAtUtc
        };

        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload));

        await _connectionProvider.PublishToDefaultExchangeAsync(
            routingKey: _options.OrdersQueue,
            body: body,
            configureProperties: properties =>
            {
                properties.Persistent = true;
                properties.ContentType = "application/json";
            },
            cancellationToken: cancellationToken);
    }
}
