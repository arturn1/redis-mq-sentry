using Microsoft.AspNetCore.Mvc;
using Orders.Api.Contracts;
using Orders.Application.Abstractions;
using Orders.Application.DTOs;
using Orders.Domain.Entities;

namespace Orders.Api.Controllers.V2;

/// <summary>
/// Orders API v2: Redis backend (contract version aware)
/// Latest version. Recommended for new integrations.
/// </summary>
[ApiController]
[Route("api/v2/orders")]
public class OrdersControllerV2 : ControllerBase
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderPublisher _orderPublisher;

    public OrdersControllerV2(
        IOrderRepository orderRepository,
        [FromKeyedServices("v2")] IOrderPublisher orderPublisher)
    {
        _orderRepository = orderRepository;
        _orderPublisher = orderPublisher;
    }

    /// <summary>
    /// Create a new order (v2 - Redis)
    /// Accepts optional contractVersion header (defaults to v1 for backward compatibility)
    /// </summary>
    [HttpPost]
    [Produces("application/json")]
    public async Task<IActionResult> Create(
        [FromBody] CreateOrderHttpRequest request,
        [FromHeader(Name = "X-Contract-Version")] string contractVersion = "v1",
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerName))
            return BadRequest(new { message = "CustomerName é obrigatório." });

        if (request.TotalAmount <= 0)
            return BadRequest(new { message = "TotalAmount deve ser maior que zero." });

        // Validate contract version
        if (contractVersion != "v1" && contractVersion != "v2")
        {
            return BadRequest(new
            {
                message = "Invalid X-Contract-Version header.",
                supported = new[] { "v1", "v2" },
                received = contractVersion
            });
        }

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

        // Response headers with contract info
        Response.Headers.Add("X-Contract-Version", contractVersion);
        Response.Headers.Add("X-Backend", "Redis");

        return CreatedAtAction(nameof(List), new { id = order.Id }, response);
    }

    /// <summary>
    /// List orders with pagination (v2 - Redis)
    /// Accepts optional contractVersion header (defaults to v1)
    /// </summary>
    [HttpGet]
    [Produces("application/json")]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromHeader(Name = "X-Contract-Version")] string contractVersion = "v1",
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;

        // Validate contract version
        if (contractVersion != "v1" && contractVersion != "v2")
        {
            return BadRequest(new
            {
                message = "Invalid X-Contract-Version header.",
                supported = new[] { "v1", "v2" },
                received = contractVersion
            });
        }

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

        // Response headers with contract info
        Response.Headers.Add("X-Contract-Version", contractVersion);
        Response.Headers.Add("X-Backend", "Redis");

        return Ok(new { orders = response, total });
    }
}
