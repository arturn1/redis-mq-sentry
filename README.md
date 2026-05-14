# redis-mq-sentry

## Visão geral

Este repositório é um laboratório de mensageria, processamento assíncrono, observabilidade e testes de carga. O ambiente combina Redis, RabbitMQ, Kafka, MongoDB, SQL Server, Prometheus, Grafana, k6, uma API .NET 8 e uma interface Next.js para explorar os fluxos de ponta a ponta.

## Componentes principais

### Aplicações

- **front-end**: interface Next.js com páginas para Redis, RabbitMQ, Kafka, pedidos no banco, logs centralizados e relatórios k6.
- **bull-board-app**: serviço Node.js que publica jobs/eventos, integra Redis e RabbitMQ, expõe Bull Board e registra logs de filas.
- **orders-api-dotnet**: API .NET 8 para criação e consulta de pedidos, com integração a mensageria e métricas.
- **producer-kafka**: produtor HTTP para publicação de mensagens no Kafka.
- **consumer-kafka**: consumidor de mensagens Kafka.
- **consumer-redis-orders**: consumidor de pedidos individuais enviados para Redis/Bull.
- **consumer-redis-batch-orders**: consumidor de lotes de pedidos enviados para Redis/Bull.
- **consumer-rabbitmq**: consumidor de mensagens publicadas no RabbitMQ.

### Infraestrutura local

- **redis** e **redis-commander** para filas e inspeção de chaves.
- **rabbitmq** com painel de administração.
- **zookeeper**, **kafka** e **kafka-ui** para streaming e inspeção de tópicos.
- **mongo** para centralização e consulta dos logs exibidos na tela `logs-db`.
- **sqlserver** para persistência consultada pela API de pedidos.
- **prometheus** e **grafana** para métricas e dashboards.
- **grafana-k6-1** até **grafana-k6-5** para execução e exportação de relatórios de carga com k6.

## Fluxos cobertos

- **Redis / Bull**: envio de pedidos individuais e em lote, processamento assíncrono e visualização das filas no Bull Board.
- **RabbitMQ**: publicação e consumo de mensagens com suporte ao painel nativo do broker.
- **Kafka**: produção e consumo de eventos com visualização no Kafka UI.
- **Orders DB**: criação e listagem de pedidos via API .NET, com consulta pelo frontend.
- **Logs DB**: consulta paginada de logs em MongoDB com filtros por aplicação, trace ID, status, método e action.
- **k6**: disparo de testes de carga e visualização dos relatórios HTML gerados.

## Como subir o ambiente

### Pré-requisitos

- Docker
- Docker Compose

### Comando

```sh
docker compose up --build
```

## Endpoints e interfaces

### UIs principais

- Front-end: http://localhost:3000
- Bull Board: http://localhost:4000/bull-board
- Orders API Swagger: http://localhost:5002/swagger
- RabbitMQ Management: http://localhost:15672
- Kafka UI: http://localhost:8080
- Redis Commander: http://localhost:8081
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

### Credenciais padrão

- RabbitMQ: `guest` / `guest`
- Grafana: `admin` / `admin`
- SQL Server: `SA` / `Your_strong_password123`

## Navegação pelo frontend

- `/redis`: operações com filas Redis/Bull.
- `/rabbitmq`: publicação e acompanhamento de mensagens RabbitMQ.
- `/kafka`: envio e inspeção de mensagens Kafka.
- `/orders-db`: consulta e criação de pedidos via Orders API.
- `/logs-db`: consulta de logs centralizados no MongoDB.
- `/k6`: listagem e visualização de relatórios HTML dos testes de carga.

## Observabilidade

- O `bull-board-app`, os consumidores e a Orders API expõem métricas coletadas pelo Prometheus.
- O Grafana é provisionado com dashboards para API, consumidores e serviços de mensageria.
- Os logs consultados no frontend são lidos da collection MongoDB configurada por `MONGODB_URI`, `MONGODB_DB` e `MONGODB_COLLECTION`.

## Estrutura do repositório

- `front-end/`: interface e rotas internas para consumo dos serviços.
- `bull-board-app/`: publicação de jobs, integração entre filas e monitoramento.
- `orders-api-dotnet/`: backend .NET 8 com arquitetura em camadas.
- `consumer-*` e `producer-kafka/`: serviços de produção e consumo.
- `observability/`: provisionamento de Prometheus e Grafana.
- `k6/`: scripts e relatórios de carga.

## Objetivo do laboratório

O foco do projeto é permitir experimentação local com padrões comuns de sistemas distribuídos: filas, eventos, processamento assíncrono, rastreabilidade, métricas, dashboards e testes de carga. A ideia é manter o ambiente didático, modular e fácil de expandir.
