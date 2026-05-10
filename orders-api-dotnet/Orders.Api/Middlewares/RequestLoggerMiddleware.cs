using System.Diagnostics;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

public class RequestLoggerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly string _appName;
    private readonly string _logDirectory = @"/logger/logs";
    private readonly object _fileLock = new object();

    public RequestLoggerMiddleware(RequestDelegate next, IConfiguration config, ILogger<RequestLoggerMiddleware> logger)
    {
        _next = next;
        _appName = config["ApplicationName"] ?? "App";

        if (!Directory.Exists(_logDirectory))
            Directory.CreateDirectory(_logDirectory);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var traceId = context.Request.Headers["X-Trace-Id"].FirstOrDefault() ?? Guid.NewGuid().ToString();
        var timestamp = DateTime.UtcNow;
        var stopwatch = Stopwatch.StartNew();
        string body = "";
        int statusCode;
        string stackTrace = "";
        Exception? capturedException = null;

        // Captura body (sem expor dados)
        try
        {
            context.Request.EnableBuffering();
            using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true);
            body = await reader.ReadToEndAsync();
            context.Request.Body.Position = 0;
        }
        catch { }

        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            capturedException = ex;
            stackTrace = ex.ToString();
        }
        finally
        {
            statusCode = capturedException is null ? context.Response.StatusCode : 500;
            stopwatch.Stop();

            var line =
                $"{_appName}\t" +
                $"{traceId}\t" +
                $"{timestamp:O}\t" +
                $"{statusCode}\t" +
                $"{stopwatch.Elapsed.TotalSeconds:F3}\t" +
                $"{context.Request.Method}\t" +
                $"{context.Request.Path}{context.Request.QueryString}\t" +
                $"{body}\t" +
                $"{stackTrace}";

            var logFileName = $"{_appName}_log_{DateTime.UtcNow:yyyyMMdd}.txt";
            var logFilePath = Path.Combine(_logDirectory, logFileName);
            var header = "appname\ttrace_id\ttimestamp\tstatus\telapsedSeconds\tmethod\taction\tbody\tstackTrace";

            try
            {
                lock (_fileLock)
                {
                    if (!File.Exists(logFilePath))
                        File.AppendAllText(logFilePath, header + Environment.NewLine, Encoding.UTF8);
                    File.AppendAllText(logFilePath, line + Environment.NewLine, Encoding.UTF8);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erro ao gravar log: {ex.Message}");
            }
        }

        if (capturedException is not null)
        {
            if (!context.Response.HasStarted)
            {
                context.Response.Clear();
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json; charset=utf-8";
                await context.Response.WriteAsync($"{{\"message\":\"Falha ao processar a requisição.\",\"traceId\":\"{traceId}\"}}");
            }
            return;
        }
    }
}
