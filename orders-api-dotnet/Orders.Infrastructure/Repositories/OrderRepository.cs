using Microsoft.EntityFrameworkCore;
using Orders.Application.Abstractions;
using Orders.Domain.Entities;
using Orders.Infrastructure.Persistence;

namespace Orders.Infrastructure.Repositories;

public class OrderRepository : IOrderRepository
{
    private readonly OrdersDbContext _dbContext;

    public OrderRepository(OrdersDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task AddAsync(Order order, CancellationToken cancellationToken) =>
        _dbContext.Orders.AddAsync(order, cancellationToken).AsTask();


    public async Task<List<Order>> ListAsync(CancellationToken cancellationToken) =>
        await _dbContext.Orders.AsNoTracking().ToListAsync(cancellationToken);

    public async Task<(List<Order> Orders, int Total)> ListPagedAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _dbContext.Orders.AsNoTracking();
        var total = await query.CountAsync(cancellationToken);
        var orders = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (orders, total);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        _dbContext.SaveChangesAsync(cancellationToken);
}
