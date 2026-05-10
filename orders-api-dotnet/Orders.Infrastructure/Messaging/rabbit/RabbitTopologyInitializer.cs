using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Orders.Infrastructure.Messaging;

public sealed class RabbitTopologyInitializer
{
    private readonly RabbitConnectionProvider _connectionProvider;
    private readonly RabbitMqOptions _options;
    private readonly ILogger<RabbitTopologyInitializer> _logger;

    public RabbitTopologyInitializer(
        RabbitConnectionProvider connectionProvider,
        IOptions<RabbitMqOptions> options,
        ILogger<RabbitTopologyInitializer> logger)
    {
        _connectionProvider = connectionProvider;
        _options = options.Value;
        _logger = logger;
    }

    public async Task InitializeAsync(CancellationToken cancellationToken)
    {
        const int maxAttempts = 10;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                await _connectionProvider.ExecuteWithChannelAsync(channel =>
                {
                    channel.QueueDeclare(
                        queue: _options.OrdersDlqQueue,
                        durable: true,
                        exclusive: false,
                        autoDelete: false,
                        arguments: null);

                    channel.QueueDeclare(
                        queue: _options.OrdersQueue,
                        durable: true,
                        exclusive: false,
                        autoDelete: false,
                        arguments: new Dictionary<string, object>
                        {
                            { "x-dead-letter-exchange", string.Empty },
                            { "x-dead-letter-routing-key", _options.OrdersDlqQueue }
                        });
                }, cancellationToken);

                _logger.LogInformation(
                    "RabbitMQ topology initialized. Queue={OrdersQueue}, DLQ={OrdersDlqQueue}",
                    _options.OrdersQueue,
                    _options.OrdersDlqQueue);

                return;
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                _logger.LogWarning(
                    ex,
                    "RabbitMQ topology initialization failed on attempt {Attempt}/{MaxAttempts}. Retrying...",
                    attempt,
                    maxAttempts);

                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
        }

        throw new InvalidOperationException("Failed to initialize RabbitMQ topology after retries.");
    }
}