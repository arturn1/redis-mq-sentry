namespace Orders.Domain.Entities;

public enum OrderStatus
{
    Created = 1,
    Enqueued = 2,
}

public class Order
{
    public Guid Id { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public OrderStatus Status { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
