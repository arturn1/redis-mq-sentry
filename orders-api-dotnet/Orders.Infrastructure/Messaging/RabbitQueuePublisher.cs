using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using Orders.Application.Abstractions;
using Orders.Domain.Entities;

namespace Orders.Infrastructure.Messaging;

public class RabbitQueuePublisher : IRabbitQueuePublisher
{
    private readonly HttpClient _httpClient;
    private readonly RabbitMqOptions _options;

    public RabbitQueuePublisher(HttpClient httpClient, IOptions<RabbitMqOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task PublishAsync(Order order, CancellationToken cancellationToken)
    {
        var endpoint = $"{_options.ApiUrl.TrimEnd('/')}/api/rabbit/send/orders";
        var payload = new
        {
            Id = order.Id,
            CustomerName = order.CustomerName,
            TotalAmount = order.TotalAmount,
            Status = order.Status.ToString(),
            CreatedAtUtc = order.CreatedAtUtc
        };
        using var response = await _httpClient.PostAsJsonAsync(endpoint, payload, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}
