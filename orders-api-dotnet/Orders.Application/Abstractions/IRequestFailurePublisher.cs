namespace Orders.Application.Abstractions;

public record GetFailurePayload(
    string TraceId,
    string Path,
    string QueryString,
    int? Page,
    int? PageSize,
    string Error,
    string StackTrace,
    DateTime OccurredAtUtc);

public record PostFailurePayload(
    string TraceId,
    string Path,
    object RequestPayload,
    string Error,
    string StackTrace,
    DateTime OccurredAtUtc);

public interface IRequestFailurePublisher
{
    Task PublishGetFailureAsync(GetFailurePayload payload, CancellationToken cancellationToken);
    Task PublishPostFailureAsync(PostFailurePayload payload, CancellationToken cancellationToken);
}
