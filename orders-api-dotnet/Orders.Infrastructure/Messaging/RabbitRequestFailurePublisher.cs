using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Orders.Application.Abstractions;
using RabbitMQ.Client;

namespace Orders.Infrastructure.Messaging;

public class RabbitRequestFailurePublisher : IRequestFailurePublisher
{
    private readonly RabbitMqOptions _options;

    public RabbitRequestFailurePublisher(IOptions<RabbitMqOptions> options)
    {
        _options = options.Value;
    }

    public Task PublishGetFailureAsync(GetFailurePayload payload, CancellationToken cancellationToken)
        => PublishAsync(payload, _options.GetQueue, _options.GetRoutingKey, cancellationToken);

    public Task PublishPostFailureAsync(PostFailurePayload payload, CancellationToken cancellationToken)
        => PublishAsync(payload, _options.PostQueue, _options.PostRoutingKey, cancellationToken);

    private Task PublishAsync<T>(T payload, string queue, string routingKey, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var factory = new ConnectionFactory
        {
            Uri = new Uri(_options.ConnectionString),
            DispatchConsumersAsync = true,
        };

        using var connection = factory.CreateConnection();
        using var channel = connection.CreateModel();

        channel.ExchangeDeclare(_options.Exchange, ExchangeType.Direct, durable: true, autoDelete: false);
        channel.QueueDeclare(queue, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(queue, _options.Exchange, routingKey);

        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload));
        var props = channel.CreateBasicProperties();
        props.Persistent = true;
        props.ContentType = "application/json";

        channel.BasicPublish(
            exchange: _options.Exchange,
            routingKey: routingKey,
            basicProperties: props,
            body: body);

        return Task.CompletedTask;
    }
}
