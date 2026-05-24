namespace Orders.Application.DTOs;

public sealed record OrderEventItemResponse(
    int Version,
    string EventType,
    DateTime OccurredAtUtc,
    string EventData);

public sealed record OrderEventReplayResponse(
    Guid OrderId,
    string CurrentStatus,
    string? Backend,
    IReadOnlyCollection<OrderEventItemResponse> Events);
