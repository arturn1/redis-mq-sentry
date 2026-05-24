namespace Orders.Domain.Entities;

public enum OutboxStatus
{
    Pending = 1,
    Processed = 2,
    Failed = 3,
}

public class OutboxMessage
{
    public Guid Id { get; set; }
    public Guid AggregateId { get; set; }
    public string AggregateType { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public string Backend { get; set; } = string.Empty;
    public string ContractVersion { get; set; } = string.Empty;
    public OutboxStatus Status { get; set; }
    public int Attempts { get; set; }
    public DateTime AvailableAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ProcessedAtUtc { get; set; }
    public string? LastError { get; set; }
}
