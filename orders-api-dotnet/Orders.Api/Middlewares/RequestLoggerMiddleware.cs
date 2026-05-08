using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System.IdentityModel.Tokens.Jwt;

public class RequestLoggerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly string _appName;
    private readonly string _logDirectory = @"/logger/logs";
    private readonly object _fileLock = new object();

    public RequestLoggerMiddleware(RequestDelegate next, IConfiguration config)
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
        int statusCode = 0;
        string? error = null;

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
            statusCode = context.Response.StatusCode;
        }
        catch (Exception ex)
        {
            error = Sanitize(ex.Message);
            statusCode = 500;
        }
        stopwatch.Stop();

        var token = ExtractToken(context);
        var userId = ExtractUserIdFromToken(token) ?? string.Empty;

        string Hash(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return "";
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input));
            return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        }

        var line =
            $"{_appName}\t" +
            $"{traceId}\t" +
            $"{timestamp:O}\t" +
            $"{statusCode}\t" +
            $"{stopwatch.Elapsed.TotalSeconds:F3}\t" +
            $"{context.Request.Method}\t" +
            $"{context.Request.Path}{context.Request.QueryString}\t" +
            $"{userId}\t" +
            $"{Hash(token)}";

        var logFileName = $"{_appName}_log_{DateTime.UtcNow:yyyyMMdd}.txt";
        var logFilePath = Path.Combine(_logDirectory, logFileName);
        var header = "appname\ttrace_id\ttimestamp\tstatus\telapsedSeconds\tmethod\taction\tuserid\ttoken";

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

    private static string Sanitize(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "";
        return text.Replace("\t", " ").Replace("\r", " ").Replace("\n", " ").Trim();
    }

    private static string ExtractToken(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue("Authorization", out var auth))
        {
            var token = auth.ToString();
            if (token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                return token.Substring("Bearer ".Length).Trim();
            return token;
        }
        return "";
    }

    private static string? ExtractUserIdFromToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        try
        {
            var handler = new JwtSecurityTokenHandler();
            if (!handler.CanReadToken(token)) return null;
            var jwt = handler.ReadJwtToken(token);
            var sub = jwt.Claims.FirstOrDefault(c => c.Type == "sub" || c.Type == "userId")?.Value;
            return !string.IsNullOrWhiteSpace(sub) ? sub : null;
        }
        catch
        {
            return null;
        }
    }
}
