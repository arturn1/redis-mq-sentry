using Orders.Application.Abstractions;

namespace Orders.Api.BackgroundServices;

public class OrderAssignmentImportBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(2);

    public OrderAssignmentImportBackgroundService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var importService = scope.ServiceProvider.GetRequiredService<IOrderAssignmentImportService>();
                await importService.ProcessPendingAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OrderAssignmentImportBackgroundService] {ex.Message}");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }
}
