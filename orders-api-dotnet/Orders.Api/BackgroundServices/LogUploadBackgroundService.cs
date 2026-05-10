using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using MongoDB.Driver;
using System.Text;

public class LogUploadBackgroundService : BackgroundService
{
    private readonly string _logDirectory = "/logger/logs";
    private readonly string _appName;
    private readonly string _mongoConn;
    private readonly string _mongoDb;
    private readonly string _mongoCollection;
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(1);

    public LogUploadBackgroundService(IConfiguration config)
    {
        _appName = config["ApplicationName"] ?? "App";
        _mongoConn = config["Mongo:ConnectionString"] ?? "mongodb://mongo:27017";
        _mongoDb = config["Mongo:Database"] ?? "logs";
        _mongoCollection = config["Mongo:Collection"] ?? "app_logs";
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await UploadLogsAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[LogUploadBackgroundService] {ex.Message}");
                }

                await Task.Delay(_interval, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Encerramento normal do host.
        }
    }

    private async Task UploadLogsAsync()
    {
        var logFiles = Directory.GetFiles(_logDirectory, $"{_appName}_log_*.txt");
        var client = new MongoClient(_mongoConn);
        var db = client.GetDatabase(_mongoDb);
        var collection = db.GetCollection<MongoLogEntry>(_mongoCollection);

        foreach (var file in logFiles)
        {
            var lines = await File.ReadAllLinesAsync(file, Encoding.UTF8);
            if (lines.Length <= 1) continue; // Só header
            var entries = new List<MongoLogEntry>();
            for (int i = 1; i < lines.Length; i++)
            {
                var cols = lines[i].Split('\t');
                if (cols.Length < 10) continue;

                entries.Add(new MongoLogEntry
                {
                    appname = cols[0],
                    trace_id = cols[1],
                    timestamp = cols[2],
                    status = cols[3],
                    elapsedSeconds = cols[4],
                    method = cols[5],
                    action = cols[6],
                    userid = cols[7],
                    body = cols[8],
                    stackTrace = cols[9]
                });
            }
            if (entries.Count > 0)
            {
                await collection.InsertManyAsync(entries);
                // Limpa arquivo após upload
                await File.WriteAllTextAsync(file, lines[0] + "\n", Encoding.UTF8);
            }
        }
    }

    public class MongoLogEntry
    {
        public string appname { get; set; } = string.Empty;
        public string trace_id { get; set; } = string.Empty;
        public string timestamp { get; set; } = string.Empty;
        public string status { get; set; } = string.Empty;
        public string elapsedSeconds { get; set; } = string.Empty;
        public string method { get; set; } = string.Empty;
        public string action { get; set; } = string.Empty;
        public string userid { get; set; } = string.Empty;
        public string body { get; set; } = string.Empty;
        public string stackTrace { get; set; } = string.Empty;
    }
}
