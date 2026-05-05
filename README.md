# redis-mq-sentry

## Propósito

Este projeto é um laboratório de estudos sobre arquitetura distribuída, mensageria, filas, jobs em background, integração entre serviços e observabilidade. Ele serve como playground técnico para experimentar e aprender conceitos modernos de backend e integração com front-end.

## Arquitetura e Serviços

- **frontend-next**: Aplicação Next.js que centraliza a interface, expõe APIs e páginas para acionar e visualizar funcionalidades dos serviços.
- **bull-board-app**: Backend Node.js com Bull Board para monitoramento de filas Bull/BullMQ e integração com RabbitMQ.
- **consumer-redis-fast**: Consumer de jobs BullMQ (Redis), simula processamento rápido.
- **consumer-redis-slow**: Consumer de jobs BullMQ (Redis), simula processamento lento.
- **consumer-rabbitmq**: Consumer de mensagens RabbitMQ.
- **orders-api-dotnet**: API .NET 8 (Clean Architecture) para criar pedidos, persistir em EF InMemory e publicar na fila `redis-slow`.
- **redis**: Banco de dados Redis (via Docker).
- **rabbitmq**: Broker RabbitMQ (via Docker).
- **sentry**: (Reservado para integração futura de observabilidade).

## Como Executar

1. Certifique-se de ter Docker e Docker Compose instalados.
2. Suba todos os serviços:

```sh
docker compose up --build
```

3. Acesse os serviços:
	- Front-end: http://localhost:3000
	- Bull Board: http://localhost:4000/bull-board
	- RabbitMQ Management: http://localhost:15672 (user/pass: guest/guest)
	- Orders API (.NET 8): http://localhost:5002/swagger
	- Prometheus: http://localhost:9090
	- Grafana: http://localhost:3001 (user/pass: admin/admin)

## Fluxo Básico

- O front-end Next.js expõe páginas e APIs para disparar jobs/mensagens para Redis e RabbitMQ.
- O serviço `bull-board-app` recebe as requisições do front-end e publica nas filas correspondentes.
- Os consumers processam as filas e simulam diferentes padrões de consumo.
- O Bull Board permite visualizar o estado das filas Redis.

## Pontos de Extensão

- Adicionar novos serviços (ex: Kafka, Sentry, observabilidade, tracing, cache, eventos, etc).
- Criar exemplos didáticos de integração e monitoramento.
- Documentar cada novo recurso no diretório `docs/`.
- Adicionar painéis e endpoints no Next.js para acionar e visualizar novas funcionalidades.

## Diretrizes

- Estrutura modular e didática.
- Mudanças incrementais e bem documentadas.
- Não remover funcionalidades existentes sem justificativa.
- Toda nova tecnologia deve vir acompanhada de exemplos e documentação.

## Contribuição

Sinta-se à vontade para propor melhorias, exemplos ou integrações. O objetivo é evoluir continuamente este laboratório de estudos!
