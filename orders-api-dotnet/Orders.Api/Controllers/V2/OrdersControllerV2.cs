using Microsoft.AspNetCore.Mvc;
using Orders.Api.Contracts;
using Orders.Application.Abstractions;
using Orders.Application.DTOs;

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
    private readonly IOrderWorkflowService _orderWorkflowService;

    public OrdersControllerV2(
        IOrderRepository orderRepository,
        IOrderWorkflowService orderWorkflowService)
    {
        _orderRepository = orderRepository;
        _orderWorkflowService = orderWorkflowService;
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

        OrderResponse response;
        try
        {
            response = await _orderWorkflowService.CreateWithOutboxSagaAsync(
                new CreateOrderRequest(request.CustomerName.Trim(), request.TotalAmount),
                backend: "redis",
                contractVersion,
                cancellationToken);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error creating workflow: " + ex.Message });
        }

        // Response headers with contract info
        Response.Headers.Add("X-Contract-Version", contractVersion);
        Response.Headers.Add("X-Backend", "Redis");

        return CreatedAtAction(nameof(List), new { id = response.Id }, response);
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

    /// <summary>
    /// Event Sourcing (isolated): replay event stream for one order.
    /// </summary>
    [HttpGet("{orderId:guid}/event-state")]
    [Produces("application/json")]
    public async Task<IActionResult> ReplayEventState(Guid orderId, CancellationToken cancellationToken)
    {
        var replay = await _orderWorkflowService.ReplayOrderStateAsync(orderId, cancellationToken);
        if (replay == null)
        {
            return NotFound(new { message = "No event stream found for this order." });
        }

        return Ok(replay);
    }
}
