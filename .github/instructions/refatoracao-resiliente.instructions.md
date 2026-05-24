---
description: "Use when refactoring, improving reliability, hardening error handling, or making changes that must not freeze, stop, or destabilize the app."
name: "Refatoracao Resiliente"
applyTo:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.cs"
---

# Refatoracao Resiliente

- Preserve existing behavior; make changes incrementally and keep them easy to revert.
- Prioritize resilience and reliability over cleverness.
- Handle errors explicitly and avoid unhandled exceptions that can crash a worker, request, or process.
- Validate inputs and boundaries early, especially in queue, API, and background-job flows.
- Prefer graceful degradation, retry-aware logic, and safe fallbacks when a dependency fails.
- Keep the code simple, readable, and free of unnecessary duplication.
- When a change touches a critical path, consider timeouts, retries, idempotency, concurrency, and recovery.
- If a change can affect stability, add or update a focused test for the failure path.

Fundamentos de arquitetura distribuída
Definir contratos de mensagem versionados (ex.: v1, v2) para Redis, RabbitMQ e Kafka.
Adicionar validação de schema no produtor e no consumidor.
Aprendizado: compatibilidade retroativa, evolução de eventos, desacoplamento.
Confiabilidade e resiliência
Implementar retry com backoff exponencial + jitter.
Criar Dead Letter Queue (DLQ) para cada broker e dashboard simples de análise.
Adicionar idempotência no consumo (evitar processamento duplicado).
Aprendizado: falhas reais, garantia “at least once”, padrões de recuperação.
Observabilidade ponta a ponta
Padronizar traceId/correlationId em todos os serviços e mensagens.
Criar tracing distribuído (OpenTelemetry) ligando frontend -> API -> brokers -> consumers.
Definir SLI/SLO básicos: latência p95, taxa de erro, throughput, lag.
Aprendizado: debugar sistemas distribuídos sem “adivinhação”.
Qualidade e testes automatizados
Criar pirâmide mínima:
unitários para regras de negócio,
integração para filas/banco,
E2E para fluxos críticos.
Introduzir testes de contrato entre produtor/consumidor.
Aprendizado: confiança para refatorar e evoluir sem quebrar fluxo.
Performance e capacidade
Evoluir cenários do k6 para incluir picos, ramp-up e soak test.
Medir gargalos por componente (API, broker, consumidor, banco).
Fazer tuning com metas explícitas (ex.: dobrar throughput mantendo erro < 1%).
Aprendizado: engenharia de capacidade baseada em métricas.
Segurança aplicada
Proteger endpoints internos com autenticação.
Sanitização e limites de payload para evitar abuso de fila.
Gestão de segredos fora do código.
Aprendizado: segurança prática em ambientes distribuídos.
Experimentos de arquitetura (nível avançado)
Implementar padrão Outbox na API de pedidos.
Criar Saga simples para fluxo de pedido com compensação.
Testar Event Sourcing em um fluxo isolado (não no sistema todo de início).
Aprendizado: consistência eventual e trade-offs arquiteturais.
Experiência de produto e operação
Painel único no frontend com “saúde do sistema” (filas, erros, lag, latência).
Modo “simulação de incidente” (injeção de falha em consumidor/broker).
“Runbooks” curtos para incidentes comuns.
Aprendizado: operar e comunicar estado do sistema como time de plataforma.