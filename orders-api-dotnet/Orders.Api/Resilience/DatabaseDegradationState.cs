namespace Orders.Api.Resilience;

public class DatabaseDegradationState
{
    private readonly object _sync = new();
    private DateTimeOffset? _activeUntilUtc;

    public bool IsActive
    {
        get
        {
            lock (_sync)
            {
                if (!_activeUntilUtc.HasValue)
                {
                    return false;
                }

                if (_activeUntilUtc.Value <= DateTimeOffset.UtcNow)
                {
                    _activeUntilUtc = null;
                    return false;
                }

                return true;
            }
        }
    }

    public DateTimeOffset? ActiveUntilUtc
    {
        get
        {
            lock (_sync)
            {
                if (!_activeUntilUtc.HasValue)
                {
                    return null;
                }

                if (_activeUntilUtc.Value <= DateTimeOffset.UtcNow)
                {
                    _activeUntilUtc = null;
                    return null;
                }

                return _activeUntilUtc;
            }
        }
    }

    public void Activate(TimeSpan duration)
    {
        var until = DateTimeOffset.UtcNow.Add(duration);

        lock (_sync)
        {
            if (!_activeUntilUtc.HasValue || until > _activeUntilUtc.Value)
            {
                _activeUntilUtc = until;
            }
        }
    }
}
