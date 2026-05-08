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
    private readonly IServiceProvider _serviceProvider;

    public LogUploadBackgroundService(IConfiguration config, IServiceProvider serviceProvider)
    {
        _appName = config["ApplicationName"] ?? "App";
        _mongoConn = config["Mongo:ConnectionString"] ?? "mongodb://mongo:27017";
        _mongoDb = config["Mongo:Database"] ?? "logs";
        _mongoCollection = config["Mongo:Collection"] ?? "app_logs";
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
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
            var header = lines[0].Split('\t');
            var entries = new List<MongoLogEntry>();
            for (int i = 1; i < lines.Length; i++)
            {
                var cols = lines[i].Split('\t');
                if (cols.Length < 9) continue;
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
                    token = cols[8]
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
        public string appname { get; set; }
        public string trace_id { get; set; }
        public string timestamp { get; set; }
        public string status { get; set; }
        public string elapsedSeconds { get; set; }
        public string method { get; set; }
        public string action { get; set; }
        public string userid { get; set; }
        public string token { get; set; }
    }
}
