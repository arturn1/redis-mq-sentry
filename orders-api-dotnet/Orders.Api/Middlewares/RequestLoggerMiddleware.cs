using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Orders.Application.Abstractions;
using Orders.Api.Resilience;
using Prometheus;
using System.IdentityModel.Tokens.Jwt;

public class RequestLoggerMiddleware
{
    private static readonly Counter RequestFailureCounter = Metrics.CreateCounter(
        "orders_api_request_failures_total",
        "Total de falhas nao tratadas processadas pelo middleware do Orders API",
        new CounterConfiguration
        {
            LabelNames = ["method", "kind"]
        });

    private static readonly Counter DbPoolTimeoutCounter = Metrics.CreateCounter(
        "orders_api_db_pool_timeouts_total",
        "Total de timeouts de pool de conexoes detectados no Orders API");

    private static readonly Gauge DbDegradedModeGauge = Metrics.CreateGauge(
        "orders_api_db_degraded_mode",
        "Indica se o Orders API esta em modo degradado por timeout de pool (1=ativo, 0=inativo)");

    private readonly RequestDelegate _next;
    private readonly string _appName;
    private readonly string _logDirectory = @"/logger/logs";
    private readonly object _fileLock = new object();
    private readonly TimeSpan _dbDegradedModeDuration;
    private readonly ILogger<RequestLoggerMiddleware> _logger;

    public RequestLoggerMiddleware(RequestDelegate next, IConfiguration config, ILogger<RequestLoggerMiddleware> logger)
    {
        _next = next;
        _appName = config["ApplicationName"] ?? "App";
        _logger = logger;
        _dbDegradedModeDuration = TimeSpan.FromSeconds(
            int.TryParse(config["Resilience:DbPoolDegradedModeSeconds"], out var seconds) && seconds > 0 ? seconds : 30);

        if (!Directory.Exists(_logDirectory))
            Directory.CreateDirectory(_logDirectory);
    }

    public async Task InvokeAsync(
        HttpContext context,
        IRequestFailurePublisher requestFailurePublisher,
        DatabaseDegradationState databaseDegradationState)
    {
        var traceId = context.Request.Headers["X-Trace-Id"].FirstOrDefault() ?? Guid.NewGuid().ToString();
        var timestamp = DateTime.UtcNow;
        var stopwatch = Stopwatch.StartNew();
        string body = "";
        int statusCode;
        string stackTrace = "";
        Exception? capturedException = null;
        Exception? publishException = null;

        // Captura body (sem expor dados)
        try
        {
            context.Request.EnableBuffering();
            using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true);
            body = await reader.ReadToEndAsync();
            context.Request.Body.Position = 0;
        }
        catch { }

        if (HttpMethods.IsPost(context.Request.Method) && databaseDegradationState.IsActive)
        {
            DbDegradedModeGauge.Set(1);

            var degradedEx = new InvalidOperationException(
                $"Database degraded mode active until {databaseDegradationState.ActiveUntilUtc:O} due to previous pool timeout.");

            try
            {
                await PublishFailureAsync(context, traceId, body, degradedEx, requestFailurePublisher);
            }
            catch (Exception fallbackEx)
            {
                publishException = fallbackEx;
                stackTrace = Sanitize($"{degradedEx}\nFallbackPublish: {fallbackEx}");
            }

            RequestFailureCounter.WithLabels(context.Request.Method, "post_degraded").Inc();

            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.ContentType = "application/json; charset=utf-8";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                message = "Servico em modo degradado. Requisicao redirecionada para fila de erros.",
                traceId,
                degradedUntilUtc = databaseDegradationState.ActiveUntilUtc,
            }));

            return;
        }
        else
        {
            DbDegradedModeGauge.Set(databaseDegradationState.IsActive ? 1 : 0);
        }

        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            capturedException = ex;
            stackTrace = Sanitize(ex.ToString());

            if (IsDbPoolTimeout(ex))
            {
                databaseDegradationState.Activate(_dbDegradedModeDuration);
                DbPoolTimeoutCounter.Inc();
                DbDegradedModeGauge.Set(1);
                _logger.LogWarning(ex,
                    "Timeout de pool detectado. Ativando modo degradado por {Seconds}s.",
                    _dbDegradedModeDuration.TotalSeconds);
            }

            try
            {
                await PublishFailureAsync(context, traceId, body, ex, requestFailurePublisher);
            }
            catch (Exception fallbackEx)
            {
                publishException = fallbackEx;
                stackTrace = Sanitize($"{ex}\nFallbackPublish: {fallbackEx}");
            }

            RequestFailureCounter.WithLabels(context.Request.Method, GetFailureKind(context.Request.Method)).Inc();
        }
        finally
        {
            statusCode = capturedException is null ? context.Response.StatusCode : 500;

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
                $"{Hash(token)}\t" +
                $"{stackTrace}";

            var logFileName = $"{_appName}_log_{DateTime.UtcNow:yyyyMMdd}.txt";
            var logFilePath = Path.Combine(_logDirectory, logFileName);
            var header = "appname\ttrace_id\ttimestamp\tstatus\telapsedSeconds\tmethod\taction\tuserid\ttoken\tstackTrace";

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

                var payload = JsonSerializer.Serialize(new
                {
                    message = publishException is null
                        ? "Falha ao processar a requisição."
                        : "Falha ao processar a requisição e ao persistir a falha no RabbitMQ.",
                    detail = publishException?.Message ?? capturedException.Message,
                    traceId,
                });

                await context.Response.WriteAsync(payload);
            }

            return;
        }
    }

    private static async Task PublishFailureAsync(HttpContext context, string traceId, string body, Exception ex, IRequestFailurePublisher requestFailurePublisher)
    {
        if (HttpMethods.IsGet(context.Request.Method))
        {
            var page = TryGetIntQuery(context, "page");
            var pageSize = TryGetIntQuery(context, "pageSize");

            await requestFailurePublisher.PublishGetFailureAsync(
                new GetFailurePayload(
                    TraceId: traceId,
                    Path: context.Request.Path,
                    QueryString: context.Request.QueryString.ToString(),
                    Page: page,
                    PageSize: pageSize,
                    Error: ex.Message,
                    StackTrace: ex.ToString(),
                    OccurredAtUtc: DateTime.UtcNow),
                CancellationToken.None);

            return;
        }

        if (HttpMethods.IsPost(context.Request.Method))
        {
            await requestFailurePublisher.PublishPostFailureAsync(
                new PostFailurePayload(
                    TraceId: traceId,
                    Path: context.Request.Path,
                    RequestPayload: ParseRequestPayload(body),
                    Error: ex.Message,
                    StackTrace: ex.ToString(),
                    OccurredAtUtc: DateTime.UtcNow),
                CancellationToken.None);
        }
    }

    private static int? TryGetIntQuery(HttpContext context, string key)
    {
        var raw = context.Request.Query[key].FirstOrDefault();
        return int.TryParse(raw, out var value) ? value : null;
    }

    private static object ParseRequestPayload(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return new { raw = string.Empty };
        }

        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.Clone();
        }
        catch
        {
            return new { raw = body };
        }
    }

    private static string GetFailureKind(string method)
        => HttpMethods.IsGet(method) ? "get" : HttpMethods.IsPost(method) ? "post" : "other";

    private static bool IsDbPoolTimeout(Exception ex)
    {
        var current = ex;
        while (current is not null)
        {
            if (current is InvalidOperationException &&
                current.Message.Contains("obtaining a connection from the pool", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            current = current.InnerException!;
        }

        return false;
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
