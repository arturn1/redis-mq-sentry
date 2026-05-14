## Versionamento de API - Implementação Point 1

### Status: ✅ Implementado

#### O que foi criado:

1. **OrdersControllerV1.cs** (`/api/v1/orders`)
   - Backend: RabbitMQ
   - Status: Deprecated (sunset 2027-01-01)
   - Headers de deprecation automáticos
   - Aponta para o mesmo `IOrderService.CreateAsync()`

2. **OrdersControllerV2.cs** (`/api/v2/orders`)
   - Backend: Redis (preparado)
   - Status: Current (recomendado)
   - Aceita header `X-Contract-Version: v1|v2` (opcional, padrão v1)
   - Aponta para o mesmo `IOrderService.CreateAsync()`

3. **README.md** com documentação de uso e migração

#### Estado atual:

**O OrderService ainda publica em RabbitMQ**, pois o Redis está comentado. Para v2 usar Redis de verdade, há 2 caminhos:

##### Opção A: Descomentar Redis no OrderService (simples)
```csharp
// OrderService.CreateAsync()
try
{
    await _orderQueuePublisher.PublishAsync(order, cancellationToken);  // Redis
    // await _rabbitQueuePublisher.PublishAsync(order, cancellationToken);
}
```
- ✅ Simples
- ❌ Ambas versões usarão Redis (v1 e v2)

##### Opção B: Router interno no OrderService (elegante)
```csharp
public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderQueuePublisher _orderQueuePublisher; // Redis
    private readonly IRabbitQueuePublisher _rabbitQueuePublisher; // RabbitMQ

    public async Task<OrderResponse> CreateAsync(
        CreateOrderRequest request, 
        CancellationToken cancellationToken,
        string backend = "rabbitmq") // novo parâmetro
    {
        var order = new Order { ... };

        try
        {
            if (backend == "redis")
            {
                await _orderQueuePublisher.PublishAsync(order, cancellationToken);
            }
            else
            {
                await _rabbitQueuePublisher.PublishAsync(order, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            throw new Exception("Error publishing order: " + ex.Message, ex);
        }

        return ToResponse(order);
    }
}
```

Depois nos controllers:
```csharp
// OrdersControllerV1.cs
await _orderService.CreateAsync(request, cancellationToken, backend: "rabbitmq");

// OrdersControllerV2.cs
await _orderService.CreateAsync(request, cancellationToken, backend: "redis");
```

##### Opção C: Factory de serviços (mais complexo, sem necessidade agora)

#### Próximos passos sugeridos:

1. **Se quiser que v2 use Redis agora:**
   - Implementar Opção B (adicionar parâmetro ao CreateAsync)
   - Ou apenas descomentar Redis em OrderService se não se importa com v1

2. **Testar os endpoints:**
```bash
# v1 (RabbitMQ, deprecated)
curl -X POST http://localhost:5002/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName": "Test", "totalAmount": 99.90}'

# v2 (Redis, current) - com contract v1 (padrão)
curl -X POST http://localhost:5002/api/v2/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName": "Test", "totalAmount": 99.90}'

# v2 (Redis, current) - com contract v2
curl -X POST http://localhost:5002/api/v2/orders \
  -H "Content-Type: application/json" \
  -H "X-Contract-Version: v2" \
  -d '{
    "customerName": "Test",
    "totalAmount": 199.90
  }'
```

3. **Swagger/OpenAPI:**
   - Os dois endpoints devem aparecer separados no Swagger
   - v1 marcado como deprecated
   - v2 como current

#### Resumo da abordagem:
- URL path versionado (`/v1/`, `/v2/`) ✅ Implementado
- Contract version por header (`X-Contract-Version`) ✅ Implementado
- Deprecation headers automáticos em v1 ✅ Implementado
- Backend selection (v1→RabbitMQ, v2→Redis) 🟡 Pronto para ativar (opção B)
- Documentação ✅ Pronta

#### Boas práticas aplicadas:
1. ✅ Padrão da indústria (GitHub, AWS, Stripe usam `/v1/`, `/v2/`)
2. ✅ Isolamento claro entre versões
3. ✅ Deprecation timeline explícita
4. ✅ Backward compatibility automática (v2 aceita v1)
5. ✅ Headers informativos e standard (Deprecation, Sunset, Link)
6. ✅ Documentação em README
7. ✅ Contract negotiation via header (future-proof para v3, v4...)
