namespace Orders.Application.DTOs;

public sealed record OrderResponse(
    Guid Id,
    string CustomerName,
    decimal TotalAmount,
    string Status,
    DateTime CreatedAtUtc
);
