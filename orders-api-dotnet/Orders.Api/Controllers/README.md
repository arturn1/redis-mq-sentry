# Orders Controller Versioning

## Overview

API versioning by URL path following REST best practices.

### v1 (Deprecated)
- **Route**: `POST/GET /api/v1/orders`
- **Backend**: RabbitMQ
- **Status**: Deprecated (sunset: 2027-01-01)
- **Use for**: Legacy integrations only

### v2 (Current)
- **Route**: `POST/GET /api/v2/orders`
- **Backend**: Redis
- **Status**: Current and recommended
- **Contract Version Header**: `X-Contract-Version: v1|v2` (optional, defaults to v1)
- **Use for**: New integrations

## Migration from v1 to v2

Simply change your endpoint from:
```
POST /api/v1/orders
```

To:
```
POST /api/v2/orders
X-Contract-Version: v1  # or v2
```

All v2 endpoints support both contract versions for backward compatibility.

## Headers

### Request
- `X-Contract-Version`: Contract version (v1 or v2). Optional, defaults to v1.

### Response
- `X-Contract-Version`: Echo of the contract version used.
- `X-Backend`: Backend used (Redis for v2, RabbitMQ for v1).
- `Deprecation`: (v1 only) Signals deprecation status.
- `Sunset`: (v1 only) Date when v1 will no longer be available.
- `Link`: (v1 only) Points to successor version.

## Examples

### v1 (Deprecated - RabbitMQ)
```bash
curl -X POST http://localhost:5002/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName": "Artur", "totalAmount": 99.90}'

# Response includes deprecation warnings
# Sunset: Wed, 01 Jan 2027 00:00:00 GMT
```

### v2 with v1 contract (default)
```bash
curl -X POST http://localhost:5002/api/v2/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName": "Artur", "totalAmount": 99.90}'

# Response:
# X-Contract-Version: v1
# X-Backend: Redis
```

### v2 with v2 contract
```bash
curl -X POST http://localhost:5002/api/v2/orders \
  -H "Content-Type: application/json" \
  -H "X-Contract-Version: v2" \
  -d '{
    "customerName": "Artur",
    "totalAmount": 199.90,
    "amount": {"value": 199.90, "currency": "BRL"},
    "createdAtIso": "2026-05-12T14:00:00Z"
  }'

# Response:
# X-Contract-Version: v2
# X-Backend: Redis
```

## Contract Evolution

### v1 Contract
```json
{
  "customerName": "string",
  "totalAmount": "number"
}
```

### v2 Contract (future enhancement)
```json
{
  "customerName": "string",
  "amount": {
    "value": "number",
    "currency": "string"
  },
  "createdAtIso": "ISO8601"
}
```

## Deprecation Timeline

- **2026-05**: v1 marked as deprecated
- **2027-01-01**: v1 sunset (no longer available)
- All clients should migrate to v2 by end of 2026
