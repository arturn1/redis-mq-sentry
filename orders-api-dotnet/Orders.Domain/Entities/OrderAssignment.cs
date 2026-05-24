namespace Orders.Domain.Entities;

public class OrderAssignment
{
    public string UserKey { get; set; } = string.Empty;
    public Guid OrderId { get; set; }
    public decimal AssignedValue { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
