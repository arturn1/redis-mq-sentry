using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Orders.Application.Abstractions;
using Orders.Application.Services;
using Orders.Infrastructure.Messaging;
using Orders.Infrastructure.Persistence;
using Orders.Infrastructure.Repositories;

namespace Orders.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<BullBoardOptions>(configuration.GetSection(BullBoardOptions.SectionName));

        services.AddDbContext<OrdersDbContext>(options =>
            options.UseInMemoryDatabase("orders-db"));

        services.AddHttpClient<RedisSlowQueuePublisher>();

        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<ISlowQueuePublisher, RedisSlowQueuePublisher>();
        services.AddScoped<IOrderService, OrderService>();

        return services;
    }
}
