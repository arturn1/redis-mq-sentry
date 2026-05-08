using Microsoft.EntityFrameworkCore;
using Orders.Infrastructure;
using Orders.Infrastructure.Persistence;
using Orders.Api.Resilience;
using Prometheus;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Threading;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSingleton<DatabaseDegradationState>();

// Adiciona o serviço de background para upload dos logs
builder.Services.AddHostedService<LogUploadBackgroundService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OrdersDbContext>();
    db.Database.Migrate();
}

var inflightRequests = 0L;
var peakInflightRequests = 0L;
var completedInCurrentSecond = 0L;
var peakRps = 0L;
TimeSpan? lastCpuTotalTime = null;
DateTimeOffset? lastCpuSampleAt = null;

#region Metrics
static double Clamp01(double value) => Math.Max(0, Math.Min(1, value));

static string? TryReadFirst(params string[] paths)
{
	foreach (var path in paths)
	{
		try
		{
			if (File.Exists(path))
			{
				return File.ReadAllText(path).Trim();
			}
		}
		catch
		{
			// ignore and try next path
		}
	}

	return null;
}

static long? TryParseLong(string? raw)
{
	if (string.IsNullOrWhiteSpace(raw))
	{
		return null;
	}

	return long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
		? value
		: null;
}

static long? GetVisibleMemoryLimitBytes()
{
	var cgroupV2 = TryReadFirst("/sys/fs/cgroup/memory.max");
	if (!string.IsNullOrWhiteSpace(cgroupV2) && !string.Equals(cgroupV2, "max", StringComparison.OrdinalIgnoreCase))
	{
		return TryParseLong(cgroupV2);
	}

	var cgroupV1 = TryParseLong(TryReadFirst("/sys/fs/cgroup/memory/memory.limit_in_bytes"));
	if (cgroupV1.HasValue && cgroupV1.Value > 0 && cgroupV1.Value < long.MaxValue / 2)
	{
		return cgroupV1;
	}

	try
	{
		foreach (var line in File.ReadLines("/proc/meminfo"))
		{
			if (!line.StartsWith("MemTotal:", StringComparison.Ordinal))
			{
				continue;
			}

			var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
			if (parts.Length >= 2 && long.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var kb))
			{
				return kb * 1024;
			}
		}
	}
	catch
	{
		// ignored
	}

	return null;
}

static long? GetVisibleMemoryUsedBytes()
{
	var cgroupCurrent = TryParseLong(TryReadFirst(
		"/sys/fs/cgroup/memory.current",
		"/sys/fs/cgroup/memory/memory.usage_in_bytes"));

	return cgroupCurrent.HasValue && cgroupCurrent.Value >= 0 ? cgroupCurrent : null;
}

static double GetVisibleCpuCores()
{
	var cpuMax = TryReadFirst("/sys/fs/cgroup/cpu.max");
	if (!string.IsNullOrWhiteSpace(cpuMax))
	{
		var parts = cpuMax.Split(' ', StringSplitOptions.RemoveEmptyEntries);
		if (parts.Length == 2 && !string.Equals(parts[0], "max", StringComparison.OrdinalIgnoreCase)
			&& double.TryParse(parts[0], NumberStyles.Float, CultureInfo.InvariantCulture, out var quota)
			&& double.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var period)
			&& quota > 0 && period > 0)
		{
			return quota / period;
		}
	}

	var quotaV1 = TryParseLong(TryReadFirst("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"));
	var periodV1 = TryParseLong(TryReadFirst("/sys/fs/cgroup/cpu/cpu.cfs_period_us"));
	if (quotaV1.HasValue && periodV1.HasValue && quotaV1.Value > 0 && periodV1.Value > 0)
	{
		return (double)quotaV1.Value / periodV1.Value;
	}

	return Environment.ProcessorCount;
}


var currentInflightGauge = Metrics.CreateGauge(
	"orders_api_inflight_requests",
	"Quantidade atual de requisições em processamento no Orders API");

var peakInflightGauge = Metrics.CreateGauge(
	"orders_api_peak_inflight_requests",
	"Maior quantidade de requisições simultaneas observada desde o start");

var peakRpsGauge = Metrics.CreateGauge(
	"orders_api_peak_rps",
	"Maior taxa de requests por segundo observada desde o start");

var managedHeapGauge = Metrics.CreateGauge(
	"orders_api_managed_heap_bytes",
	"Memoria interna gerenciada (.NET heap) em bytes");

var processRamGauge = Metrics.CreateGauge(
	"orders_api_process_ram_bytes",
	"RAM usada pelo processo do Orders API em bytes");

var visibleRamTotalGauge = Metrics.CreateGauge(
	"orders_api_visible_ram_total_bytes",
	"RAM total visivel ao container ou host, em bytes");

var visibleRamUsedGauge = Metrics.CreateGauge(
	"orders_api_visible_ram_used_bytes",
	"RAM usada no contexto visivel ao container, em bytes");

var visibleCpuCoresGauge = Metrics.CreateGauge(
	"orders_api_visible_cpu_cores",
	"Quantidade de CPUs visiveis ao container ou cgroup");

var cpuUsageRatioGauge = Metrics.CreateGauge(
	"orders_api_cpu_usage_ratio",
	"Uso atual de CPU do processo normalizado pelos cores visiveis (0 a 1)");

var diskFreeGauge = Metrics.CreateGauge(
	"orders_api_disk_free_bytes",
	"Espaco livre em disco (ROM) observado pelo container");

var diskTotalGauge = Metrics.CreateGauge(
	"orders_api_disk_total_bytes",
	"Espaco total em disco (ROM) observado pelo container");

var heapUsageRatioGauge = Metrics.CreateGauge(
	"orders_api_heap_usage_ratio",
	"Uso de heap em relacao ao limite (0 a 1)");

var ramUsageRatioGauge = Metrics.CreateGauge(
	"orders_api_ram_usage_ratio",
	"Uso de RAM do processo em relacao ao limite do runtime (0 a 1)");

var diskUsageRatioGauge = Metrics.CreateGauge(
	"orders_api_disk_usage_ratio",
	"Uso de disco (ROM) em relacao ao total (0 a 1)");

var serverHealthScoreGauge = Metrics.CreateGauge(
	"orders_api_server_health_score",
	"Saude geral do servidor em percentual (0 a 100)");

var rpsSamplerCts = new CancellationTokenSource();
_ = Task.Run(async () =>
{
	var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
	try
	{
		while (await timer.WaitForNextTickAsync(rpsSamplerCts.Token))
		{
			var currentRps = Interlocked.Exchange(ref completedInCurrentSecond, 0);
			while (true)
			{
				var observedPeak = Interlocked.Read(ref peakRps);
				if (currentRps <= observedPeak)
				{
					break;
				}

				if (Interlocked.CompareExchange(ref peakRps, currentRps, observedPeak) == observedPeak)
				{
					break;
				}
			}

			peakRpsGauge.Set(Interlocked.Read(ref peakRps));
		}
	}
	catch (OperationCanceledException)
	{
		// shutdown
	}
	finally
	{
		timer.Dispose();
	}
});

var healthSamplerCts = new CancellationTokenSource();
_ = Task.Run(async () =>
{
	var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
	try
	{
		while (await timer.WaitForNextTickAsync(healthSamplerCts.Token))
		{
			var process = Process.GetCurrentProcess();
			process.Refresh();
			var now = DateTimeOffset.UtcNow;

			var heapBytes = GC.GetTotalMemory(false);
			var heapLimitBytes = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
			var processRamBytes = process.WorkingSet64;
			var visibleRamTotalBytes = GetVisibleMemoryLimitBytes() ?? heapLimitBytes;
			var visibleRamUsedBytes = GetVisibleMemoryUsedBytes() ?? processRamBytes;
			var visibleCpuCores = Math.Max(GetVisibleCpuCores(), 1d);

			double cpuUsage = 0;
			if (lastCpuSampleAt.HasValue && lastCpuTotalTime.HasValue)
			{
				var elapsedWallSeconds = (now - lastCpuSampleAt.Value).TotalSeconds;
				var elapsedCpuSeconds = (process.TotalProcessorTime - lastCpuTotalTime.Value).TotalSeconds;
				if (elapsedWallSeconds > 0)
				{
					cpuUsage = Clamp01(elapsedCpuSeconds / (elapsedWallSeconds * visibleCpuCores));
				}
			}

			lastCpuSampleAt = now;
			lastCpuTotalTime = process.TotalProcessorTime;

			managedHeapGauge.Set(heapBytes);
			processRamGauge.Set(processRamBytes);
			visibleRamTotalGauge.Set(visibleRamTotalBytes);
			visibleRamUsedGauge.Set(visibleRamUsedBytes);
			visibleCpuCoresGauge.Set(visibleCpuCores);
			cpuUsageRatioGauge.Set(cpuUsage);

			var heapUsage = heapLimitBytes > 0 ? Clamp01((double)heapBytes / heapLimitBytes) : 0;
			var ramUsage = visibleRamTotalBytes > 0 ? Clamp01((double)visibleRamUsedBytes / visibleRamTotalBytes) : 0;

			heapUsageRatioGauge.Set(heapUsage);
			ramUsageRatioGauge.Set(ramUsage);

			double diskUsage = 0;
			try
			{
				var disk = new DriveInfo("/");
				if (disk.IsReady && disk.TotalSize > 0)
				{
					var totalBytes = disk.TotalSize;
					var freeBytes = disk.AvailableFreeSpace;
					diskTotalGauge.Set(totalBytes);
					diskFreeGauge.Set(freeBytes);
					diskUsage = Clamp01(1 - ((double)freeBytes / totalBytes));
					diskUsageRatioGauge.Set(diskUsage);
				}
			}
			catch
			{
				// em alguns ambientes o filesystem pode nao estar disponivel
			}

			var health = 100 * ((1 - ramUsage) * 0.45 + (1 - cpuUsage) * 0.30 + (1 - diskUsage) * 0.15 + (1 - heapUsage) * 0.10);
			serverHealthScoreGauge.Set(Math.Round(Clamp01(health / 100) * 100, 2));
		}
	}
	catch (OperationCanceledException)
	{
		// shutdown
	}
	finally
	{
		timer.Dispose();
	}
});
#endregion

app.Lifetime.ApplicationStopping.Register(() => rpsSamplerCts.Cancel());
app.Lifetime.ApplicationStopping.Register(() => healthSamplerCts.Cancel());

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthorization();
app.UseHttpMetrics();

app.UseMiddleware<RequestLoggerMiddleware>();
app.MapControllers();
app.MapMetrics();

app.Run();
