using System.Collections.Concurrent;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Exceptions;

namespace Orders.Infrastructure.Messaging;

public sealed class RabbitConnectionProvider : IDisposable
{
    private readonly ConnectionFactory _factory;
    private readonly SemaphoreSlim _connectionLock = new(1, 1);
    private readonly ConcurrentBag<IModel> _idleChannels = new();
    private readonly ConcurrentDictionary<IModel, byte> _allChannels = new();
    private readonly int _maxPooledChannels;

    private IConnection? _connection;
    private bool _disposed;

    public RabbitConnectionProvider(IOptions<RabbitMqOptions> options)
    {
        var rabbitOptions = options.Value;
        _maxPooledChannels = Math.Max(8, Environment.ProcessorCount * 2);

        _factory = new ConnectionFactory
        {
            AutomaticRecoveryEnabled = true,
            TopologyRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(5),
            RequestedHeartbeat = TimeSpan.FromSeconds(30)
        };

        if (!string.IsNullOrWhiteSpace(rabbitOptions.ConnectionString))
        {
            _factory.Uri = new Uri(rabbitOptions.ConnectionString);
        }
        else
        {
            _factory.HostName = rabbitOptions.HostName;
            _factory.Port = rabbitOptions.Port;
            _factory.UserName = rabbitOptions.UserName;
            _factory.Password = rabbitOptions.Password;
            _factory.VirtualHost = rabbitOptions.VirtualHost;
        }
    }

    public async Task ExecuteWithChannelAsync(Action<IModel> action, CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 2; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var connection = await GetOrCreateConnectionAsync(cancellationToken);
            var channel = await RentChannelAsync(connection, cancellationToken);
            var returnToPool = true;

            try
            {
                action(channel);
                return;
            }
            catch (AlreadyClosedException) when (attempt == 0)
            {
                returnToPool = false;
                InvalidateChannel(channel);
                await ResetConnectionAsync();
            }
            catch (BrokerUnreachableException) when (attempt == 0)
            {
                returnToPool = false;
                InvalidateChannel(channel);
                await ResetConnectionAsync(force: true);
            }
            catch (OperationInterruptedException) when (attempt == 0)
            {
                returnToPool = false;
                InvalidateChannel(channel);
                await ResetConnectionAsync();
            }
            finally
            {
                if (returnToPool)
                {
                    ReturnChannel(channel);
                }
            }
        }

        throw new Exception("Failed to execute RabbitMQ operation after retry.");
    }

    public Task PublishToDefaultExchangeAsync(
        string routingKey,
        byte[] body,
        Action<IBasicProperties> configureProperties,
        CancellationToken cancellationToken)
    {
        return ExecuteWithChannelAsync(channel =>
        {
            var properties = channel.CreateBasicProperties();
            configureProperties(properties);

            channel.BasicPublish(
                exchange: string.Empty,
                routingKey: routingKey,
                basicProperties: properties,
                body: body);
        }, cancellationToken);
    }

    private async Task<IConnection> GetOrCreateConnectionAsync(CancellationToken cancellationToken)
    {
        if (_disposed)
        {
            throw new ObjectDisposedException(nameof(RabbitConnectionProvider));
        }

        if (_connection is { IsOpen: true })
        {
            return _connection;
        }

        await _connectionLock.WaitAsync(cancellationToken);
        try
        {
            if (_connection is { IsOpen: true })
            {
                return _connection;
            }

            _connection?.Dispose();
            _connection = _factory.CreateConnection();
            return _connection;
        }
        finally
        {
            _connectionLock.Release();
        }
    }

    private async Task<IModel> RentChannelAsync(IConnection connection, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        while (_idleChannels.TryTake(out var channel))
        {
            if (channel.IsOpen)
            {
                return channel;
            }

            InvalidateChannel(channel);
        }

        if (_allChannels.Count < _maxPooledChannels)
        {
            var newChannel = connection.CreateModel();
            _allChannels.TryAdd(newChannel, 0);
            return newChannel;
        }

        return connection.CreateModel();
    }

    private void ReturnChannel(IModel channel)
    {
        if (_disposed || !channel.IsOpen)
        {
            InvalidateChannel(channel);
            return;
        }

        if (_allChannels.ContainsKey(channel))
        {
            _idleChannels.Add(channel);
            return;
        }

        channel.Dispose();
    }

    private void InvalidateChannel(IModel channel)
    {
        _allChannels.TryRemove(channel, out _);
        try
        {
            channel.Dispose();
        }
        catch
        {
            // Best effort cleanup.
        }
    }

    private async Task ResetConnectionAsync(bool force = false)
    {
        await _connectionLock.WaitAsync();
        try
        {
            if (!force && _connection is { IsOpen: true })
            {
                return;
            }

            try
            {
                _connection?.Dispose();
            }
            catch
            {
                // Best effort cleanup.
            }

            _connection = null;

            while (_idleChannels.TryTake(out _))
            {
            }

            foreach (var kv in _allChannels.ToArray())
            {
                InvalidateChannel(kv.Key);
            }
        }
        finally
        {
            _connectionLock.Release();
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;

        while (_idleChannels.TryTake(out _))
        {
        }

        foreach (var kv in _allChannels.ToArray())
        {
            InvalidateChannel(kv.Key);
        }

        _connection?.Dispose();
        _connectionLock.Dispose();
    }
}