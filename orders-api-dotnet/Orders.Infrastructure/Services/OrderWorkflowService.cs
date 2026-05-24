using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Orders.Application.Abstractions;
using Orders.Application.DTOs;
using Orders.Domain.Entities;
using Orders.Infrastructure.Persistence;

namespace Orders.Infrastructure.Services;

public class OrderWorkflowService : IOrderWorkflowService
{
    private readonly OrdersDbContext _dbContext;

    public OrderWorkflowService(OrdersDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<OrderResponse> CreateWithOutboxSagaAsync(
        CreateOrderRequest request,
        string backend,
        string contractVersion,
        CancellationToken cancellationToken)
    {
        var normalizedBackend = NormalizeBackend(backend);
        var normalizedContractVersion = NormalizeContractVersion(contractVersion);

        var now = DateTime.UtcNow;
        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerName = request.CustomerName.Trim(),
            TotalAmount = request.TotalAmount,
            CreatedAtUtc = now,
            Status = OrderStatus.Created,
        };

        var saga = new OrderSagaState
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            Status = OrderSagaStatus.Started,
            CurrentStep = "OrderCreated",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        var outboxPayload = new OrderOutboxPayload
        {
            OrderId = order.Id,
            CustomerName = order.CustomerName,
            TotalAmount = order.TotalAmount,
            CreatedAtUtc = order.CreatedAtUtc,
            Status = (int)order.Status,
            Backend = normalizedBackend,
            ContractVersion = normalizedContractVersion,
        };

        var outbox = new OutboxMessage
        {
            Id = Guid.NewGuid(),
            AggregateId = order.Id,
            AggregateType = "Order",
            EventType = "OrderCreated",
            Payload = JsonSerializer.Serialize(outboxPayload),
            Backend = normalizedBackend,
            ContractVersion = normalizedContractVersion,
            Status = OutboxStatus.Pending,
            Attempts = 0,
            AvailableAtUtc = now,
            CreatedAtUtc = now,
        };

        var createdEvent = new OrderEventStoreEntry
        {
            Id = Guid.NewGuid(),
            AggregateId = order.Id,
            AggregateType = "Order",
            Version = 1,
            EventType = "OrderCreated",
            EventData = JsonSerializer.Serialize(new
            {
                order.Id,
                order.CustomerName,
                order.TotalAmount,
                Status = order.Status.ToString(),
                Backend = normalizedBackend,
                ContractVersion = normalizedContractVersion,
                CreatedAtUtc = order.CreatedAtUtc,
            }),
            OccurredAtUtc = now,
        };

        _dbContext.Orders.Add(order);
        _dbContext.OrderSagaStates.Add(saga);
        _dbContext.OutboxMessages.Add(outbox);
        _dbContext.OrderEventStoreEntries.Add(createdEvent);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new OrderResponse(
            order.Id,
            order.CustomerName,
            order.TotalAmount,
            order.Status.ToString(),
            order.CreatedAtUtc);
    }

    public async Task<OrderEventReplayResponse?> ReplayOrderStateAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var events = await _dbContext.OrderEventStoreEntries
            .AsNoTracking()
            .Where(x => x.AggregateId == orderId)
            .OrderBy(x => x.Version)
            .ToListAsync(cancellationToken);

        if (events.Count == 0)
        {
            return null;
        }

        var eventItems = events
            .Select(x => new OrderEventItemResponse(x.Version, x.EventType, x.OccurredAtUtc, x.EventData))
            .ToList();

        var currentStatus = "Unknown";
        string? backend = null;

        foreach (var item in events)
        {
            using var doc = JsonDocument.Parse(item.EventData);
            if (doc.RootElement.TryGetProperty("Status", out var statusProp) && statusProp.ValueKind == JsonValueKind.String)
            {
                currentStatus = statusProp.GetString() ?? currentStatus;
            }

            if (doc.RootElement.TryGetProperty("Backend", out var backendProp) && backendProp.ValueKind == JsonValueKind.String)
            {
                backend = backendProp.GetString();
            }
        }

        return new OrderEventReplayResponse(orderId, currentStatus, backend, eventItems);
    }

    private static string NormalizeBackend(string backend)
    {
        var normalized = (backend ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "rabbitmq" => "rabbitmq",
            "redis" => "redis",
            _ => throw new InvalidOperationException("Unsupported backend. Use rabbitmq or redis."),
        };
    }

    private static string NormalizeContractVersion(string contractVersion)
    {
        var normalized = (contractVersion ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized == "v1" || normalized == "v2")
        {
            return normalized;
        }

        throw new InvalidOperationException("Unsupported contractVersion. Use v1 or v2.");
    }
}
