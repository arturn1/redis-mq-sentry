namespace Orders.Domain.Entities;

public enum OrderSagaStatus
{
    Started = 1,
    PublishRetryScheduled = 2,
    Completed = 3,
    Compensated = 4,
}

public class OrderSagaState
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public OrderSagaStatus Status { get; set; }
    public string CurrentStep { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public string? LastError { get; set; }
}
