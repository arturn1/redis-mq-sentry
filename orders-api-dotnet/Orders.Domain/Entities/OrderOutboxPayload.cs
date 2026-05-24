namespace Orders.Domain.Entities;

public class OrderOutboxPayload
{
    public Guid OrderId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public int Status { get; set; }
    public string Backend { get; set; } = string.Empty;
    public string ContractVersion { get; set; } = string.Empty;
}
