namespace Orders.Application.DTOs;

public sealed record CreateOrderRequest(string CustomerName, decimal TotalAmount);
