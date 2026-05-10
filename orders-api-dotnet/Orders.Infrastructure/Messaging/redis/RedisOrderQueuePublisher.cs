using System.Net.Http.Json;
using System.Diagnostics;
using Microsoft.Extensions.Options;
using Orders.Application.Abstractions;
using Orders.Domain.Entities;
using Microsoft.AspNetCore.Http;

namespace Orders.Infrastructure.Messaging;

public class RedisOrderQueuePublisher : IOrderQueuePublisher
{
    private readonly HttpClient _httpClient;
    private readonly BullBoardOptions _options;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public RedisOrderQueuePublisher(
        HttpClient httpClient,
        IOptions<BullBoardOptions> options,
        IHttpContextAccessor httpContextAccessor)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task PublishAsync(Order order, CancellationToken cancellationToken)
    {
        var endpoint = $"{_options.BaseUrl.TrimEnd('/')}/api/redis-orders/send/orders";
        var payload = new
        {
            order
        };

        var context = _httpContextAccessor.HttpContext;
        var traceId =
            context?.Items["TraceId"] as string
            ?? context?.TraceIdentifier
            ?? context?.Request.Headers["X-Trace-Id"].FirstOrDefault()
            ?? Activity.Current?.TraceId.ToString();

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.TryAddWithoutValidation("X-Trace-Id", traceId);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}
