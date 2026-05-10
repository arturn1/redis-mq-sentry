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
        var endpoint = $"{_options.BaseUrl.TrimEnd('/')}/api/redis-orders/send/slow";
        var payload = new
        {
            message = $"Order {order.Id} | customer={order.CustomerName} | total={order.TotalAmount}",
            user = order.CustomerName
        };

        using var response = await _httpClient.PostAsJsonAsync(endpoint, payload, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}
