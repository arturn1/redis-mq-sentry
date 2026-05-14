using Microsoft.AspNetCore.Mvc;
using Orders.Api.Contracts;
using Orders.Application.Abstractions;
using Orders.Application.DTOs;
using Orders.Application.Services;
using Orders.Domain.Entities;

namespace Orders.Api.Controllers.V1;

/// <summary>
/// Orders API v1: RabbitMQ backend
/// Deprecated: Use v2 (Redis) for new integrations.
/// </summary>
[ApiController]
[Route("api/v1/orders")]
[Obsolete("Use v2 instead", false)]
public class OrdersControllerV1 : ControllerBase
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderPublisher _orderPublisher;

    public OrdersControllerV1(
        IOrderRepository orderRepository,
        [FromKeyedServices("v1")] IOrderPublisher orderPublisher)
    {
        _orderRepository = orderRepository;
        _orderPublisher = orderPublisher;
    }

    /// <summary>
    /// Create a new order (v1 - RabbitMQ)
    /// </summary>
    [HttpPost]
    [Produces("application/json")]
    public async Task<IActionResult> Create(
        [FromBody] CreateOrderHttpRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerName))
            return BadRequest(new { message = "CustomerName é obrigatório." });

        if (request.TotalAmount <= 0)
            return BadRequest(new { message = "TotalAmount deve ser maior que zero." });

        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerName = request.CustomerName.Trim(),
            TotalAmount = request.TotalAmount,
            CreatedAtUtc = DateTime.UtcNow,
            Status = OrderStatus.Enqueued
        };

        try
        {
            await _orderPublisher.PublishAsync(order, cancellationToken);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error publishing order: " + ex.Message });
        }

        var response = new OrderResponse(
            order.Id,
            order.CustomerName,
            order.TotalAmount,
            order.Status.ToString(),
            order.CreatedAtUtc);

        // Add deprecation headers
        Response.Headers.Add("Deprecation", "true");
        Response.Headers.Add("Sunset", "Wed, 01 Jan 2027 00:00:00 GMT");
        Response.Headers.Add("Link", "<https://api.company.com/v2/orders>; rel=\"successor-version\"");

        return CreatedAtAction(nameof(List), new { id = order.Id }, response);
    }

    /// <summary>
    /// List orders with pagination (v1 - RabbitMQ)
    /// </summary>
    [HttpGet]
    [Produces("application/json")]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;

        var (orders, total) = await _orderRepository.ListPagedAsync(page, pageSize, cancellationToken);

        var response = orders
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new OrderResponse(
                x.Id,
                x.CustomerName,
                x.TotalAmount,
                x.Status.ToString(),
                x.CreatedAtUtc))
            .ToList();

        // Add deprecation headers
        Response.Headers.Add("Deprecation", "true");
        Response.Headers.Add("Sunset", "Wed, 01 Jan 2027 00:00:00 GMT");

        return Ok(new { orders = response, total });
    }
}
