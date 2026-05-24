using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Orders.Application.Abstractions;
using Orders.Domain.Entities;
using Orders.Infrastructure.Persistence;

namespace Orders.Api.BackgroundServices;

public class OrderOutboxDispatcherBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(2);

    public OrderOutboxDispatcherBackgroundService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OrderOutboxDispatcher] {ex.Message}");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<OrdersDbContext>();

        var now = DateTime.UtcNow;
        var pendingMessages = await dbContext.OutboxMessages
            .Where(x => x.Status == OutboxStatus.Pending && x.AvailableAtUtc <= now)
            .OrderBy(x => x.CreatedAtUtc)
            .Take(20)
            .ToListAsync(cancellationToken);

        foreach (var message in pendingMessages)
        {
            await ProcessSingleMessageAsync(scope.ServiceProvider, dbContext, message, cancellationToken);
        }
    }

    private static async Task ProcessSingleMessageAsync(
        IServiceProvider serviceProvider,
        OrdersDbContext dbContext,
        OutboxMessage message,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        try
        {
            var payload = JsonSerializer.Deserialize<OrderOutboxPayload>(message.Payload);
            if (payload == null)
            {
                throw new InvalidOperationException("Outbox payload could not be deserialized.");
            }

            var publisherKey = message.Backend == "redis" ? "v2" : "v1";
            var publisher = serviceProvider.GetRequiredKeyedService<IOrderPublisher>(publisherKey);

            var publishOrder = new Order
            {
                Id = payload.OrderId,
                CustomerName = payload.CustomerName,
                TotalAmount = payload.TotalAmount,
                CreatedAtUtc = payload.CreatedAtUtc,
                Status = OrderStatus.Enqueued,
            };

            await publisher.PublishAsync(publishOrder, cancellationToken);

            message.Status = OutboxStatus.Processed;
            message.ProcessedAtUtc = now;
            message.LastError = null;

            var order = await dbContext.Orders.FirstOrDefaultAsync(x => x.Id == payload.OrderId, cancellationToken);
            if (order != null)
            {
                order.Status = OrderStatus.Enqueued;
            }

            var saga = await dbContext.OrderSagaStates.FirstOrDefaultAsync(x => x.OrderId == payload.OrderId, cancellationToken);
            if (saga != null)
            {
                saga.Status = OrderSagaStatus.Completed;
                saga.CurrentStep = "OrderPublished";
                saga.UpdatedAtUtc = now;
                saga.LastError = null;
            }

            var currentVersion = await dbContext.OrderEventStoreEntries
                .Where(x => x.AggregateId == payload.OrderId)
                .MaxAsync(x => (int?)x.Version, cancellationToken) ?? 0;

            dbContext.OrderEventStoreEntries.Add(new OrderEventStoreEntry
            {
                Id = Guid.NewGuid(),
                AggregateId = payload.OrderId,
                AggregateType = "Order",
                Version = currentVersion + 1,
                EventType = "OrderPublished",
                EventData = JsonSerializer.Serialize(new
                {
                    payload.OrderId,
                    Status = OrderStatus.Enqueued.ToString(),
                    Backend = message.Backend,
                    PublishedAtUtc = now,
                }),
                OccurredAtUtc = now,
            });

            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            message.Attempts += 1;
            message.LastError = ex.Message;

            var payload = JsonSerializer.Deserialize<OrderOutboxPayload>(message.Payload);
            if (payload != null)
            {
                var saga = await dbContext.OrderSagaStates.FirstOrDefaultAsync(x => x.OrderId == payload.OrderId, cancellationToken);
                var order = await dbContext.Orders.FirstOrDefaultAsync(x => x.Id == payload.OrderId, cancellationToken);

                if (message.Attempts >= 3)
                {
                    message.Status = OutboxStatus.Failed;

                    if (order != null)
                    {
                        order.Status = OrderStatus.Compensated;
                    }

                    if (saga != null)
                    {
                        saga.Status = OrderSagaStatus.Compensated;
                        saga.CurrentStep = "CompensationApplied";
                        saga.UpdatedAtUtc = now;
                        saga.LastError = ex.Message;
                    }

                    var currentVersion = await dbContext.OrderEventStoreEntries
                        .Where(x => x.AggregateId == payload.OrderId)
                        .MaxAsync(x => (int?)x.Version, cancellationToken) ?? 0;

                    dbContext.OrderEventStoreEntries.Add(new OrderEventStoreEntry
                    {
                        Id = Guid.NewGuid(),
                        AggregateId = payload.OrderId,
                        AggregateType = "Order",
                        Version = currentVersion + 1,
                        EventType = "OrderCompensated",
                        EventData = JsonSerializer.Serialize(new
                        {
                            payload.OrderId,
                            Status = OrderStatus.Compensated.ToString(),
                            Backend = message.Backend,
                            Error = ex.Message,
                            CompensatedAtUtc = now,
                        }),
                        OccurredAtUtc = now,
                    });
                }
                else
                {
                    var delay = ComputeRetryDelay(message.Attempts);
                    message.AvailableAtUtc = now.Add(delay);

                    if (saga != null)
                    {
                        saga.Status = OrderSagaStatus.PublishRetryScheduled;
                        saga.CurrentStep = "PublishRetryScheduled";
                        saga.UpdatedAtUtc = now;
                        saga.LastError = ex.Message;
                    }
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private static TimeSpan ComputeRetryDelay(int attempt)
    {
        var baseDelayMs = 500;
        var maxDelayMs = 10000;
        var exponential = baseDelayMs * Math.Pow(2, Math.Max(0, attempt - 1));
        var jitter = Random.Shared.NextDouble() * exponential * 0.3;
        var delay = Math.Min(exponential + jitter, maxDelayMs);
        return TimeSpan.FromMilliseconds(delay);
    }
}
