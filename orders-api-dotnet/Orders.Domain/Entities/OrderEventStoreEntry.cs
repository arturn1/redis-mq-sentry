namespace Orders.Domain.Entities;

public class OrderEventStoreEntry
{
    public Guid Id { get; set; }
    public Guid AggregateId { get; set; }
    public string AggregateType { get; set; } = string.Empty;
    public int Version { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string EventData { get; set; } = string.Empty;
    public DateTime OccurredAtUtc { get; set; }
}
