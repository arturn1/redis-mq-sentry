namespace Orders.Infrastructure.Messaging;

public class RabbitMqOptions
{
    public const string SectionName = "RabbitMq";

    public string ConnectionString { get; set; } = "amqp://rabbitmq";
    public string Exchange { get; set; } = "orders-api-failures-exchange";
    public string GetQueue { get; set; } = "orders-api-failures-get";
    public string PostQueue { get; set; } = "orders-api-failures-post";
    public string GetRoutingKey { get; set; } = "orders.get.error";
    public string PostRoutingKey { get; set; } = "orders.post.error";
}
