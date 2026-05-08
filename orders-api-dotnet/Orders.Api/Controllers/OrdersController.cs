using Microsoft.AspNetCore.Mvc;
using Orders.Api.Contracts;
using Orders.Application.DTOs;
using Orders.Application.Services;

namespace Orders.Api.Controllers;

[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;

    public OrdersController(IOrderService orderService)
    {
        _orderService = orderService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrderHttpRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerName))
            return BadRequest(new { message = "CustomerName é obrigatório." });

        if (request.TotalAmount <= 0)
            return BadRequest(new { message = "TotalAmount deve ser maior que zero." });

        var created = await _orderService.CreateAsync(
            new CreateOrderRequest(request.CustomerName.Trim(), request.TotalAmount),
            cancellationToken);

        return CreatedAtAction(nameof(List), new { id = created.Id }, created);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;

        var (orders, total) = await _orderService.ListPagedAsync(page, pageSize, cancellationToken);
        return Ok(new { orders, total });
    }
}
