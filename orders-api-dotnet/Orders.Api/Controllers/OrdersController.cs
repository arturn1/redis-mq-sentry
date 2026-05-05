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

        try
        {
            var created = await _orderService.CreateAsync(
                new CreateOrderRequest(request.CustomerName.Trim(), request.TotalAmount),
                cancellationToken);

            return CreatedAtAction(nameof(List), new { id = created.Id }, created);
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { message = "Falha ao publicar na fila redis-slow.", detail = ex.Message });
        }
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var orders = await _orderService.ListAsync(cancellationToken);
        return Ok(orders);
    }
}
