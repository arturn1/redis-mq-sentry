namespace Orders.Api.Contracts;

public sealed class CreateOrderHttpRequest
{
    public string CustomerName { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
}
