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
        services.Configure<RabbitMqOptions>(configuration.GetSection(RabbitMqOptions.SectionName));

        services.AddDbContext<OrdersDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException("DefaultConnection string not found")));

        services.AddHttpContextAccessor();
        services.AddHttpClient<RedisOrderQueuePublisher>();


        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IOrderQueuePublisher, RedisOrderQueuePublisher>();
        services.AddSingleton<RabbitConnectionProvider>();
        services.AddSingleton<RabbitTopologyInitializer>();
        services.AddSingleton<IRabbitQueuePublisher, RabbitQueuePublisher>();
        services.AddScoped<IOrderService, OrderService>();

        return services;
    }
}
