using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using Orders.Application.Abstractions;
using Orders.Domain.Entities;

namespace Orders.Infrastructure.Messaging;

public class RedisSlowQueuePublisher : ISlowQueuePublisher
{
    private readonly HttpClient _httpClient;
    private readonly BullBoardOptions _options;

    public RedisSlowQueuePublisher(HttpClient httpClient, IOptions<BullBoardOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task PublishAsync(Order order, CancellationToken cancellationToken)
    {
        var endpoint = $"{_options.BaseUrl.TrimEnd('/')}/api/redis-queue/send";
        var payload = new
        {
            type = "redis-slow",
            texto = $"Order {order.Id} | customer={order.CustomerName} | total={order.TotalAmount}",
            usuario = order.CustomerName
        };

        using var response = await _httpClient.PostAsJsonAsync(endpoint, payload, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}
