namespace Orders.Infrastructure.Messaging;

public class RabbitMqOptions
{
    public const string SectionName = "RabbitMq";

    public string ApiUrl { get; set; } = string.Empty;
    public string ConnectionString { get; set; } = "amqp://guest:guest@rabbitmq:5672";
    public string HostName { get; set; } = "rabbitmq";
    public int Port { get; set; } = 5672;
    public string UserName { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string VirtualHost { get; set; } = "/";
    public string ManagementUrl { get; set; } = "http://rabbitmq:15672";

    public string Exchange { get; set; } = string.Empty;
    public string GetQueue { get; set; } = string.Empty;
    public string PostQueue { get; set; } = string.Empty;
    public string GetRoutingKey { get; set; } = string.Empty;
    public string PostRoutingKey { get; set; } = string.Empty;
}
