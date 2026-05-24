using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Orders.Application.Abstractions;
using Orders.Infrastructure.Messaging;
using Orders.Infrastructure.Persistence;
using Orders.Infrastructure.Repositories;
using Orders.Infrastructure.Services;

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

        // Publisher abstraction with keyed registration (ASP.NET Core 8+)
        // v1 explicitly uses RabbitMQ
        services.AddKeyedScoped<IOrderPublisher, RabbitOrderPublisher>("v1");
        // v2 uses Redis
        services.AddKeyedScoped<IOrderPublisher, RedisOrderPublisher>("v2");

        services.AddScoped<IOrderWorkflowService, OrderWorkflowService>();
        services.AddScoped<IOrderAssignmentImportService, OrderAssignmentImportService>();

        return services;
    }
}
