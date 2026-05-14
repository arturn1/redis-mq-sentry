import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.ORDERS_API_URL || 'http://orders-api-dotnet:5002';

// v1 metrics (RabbitMQ)
const v1CreateDuration = new Trend('v1_orders_create_duration_ms');
const v1ListDuration = new Trend('v1_orders_list_duration_ms');
const v1CreateErrors = new Counter('v1_orders_create_errors_total');
const v1ListErrors = new Counter('v1_orders_list_errors_total');
const v1CreateSuccess = new Counter('v1_orders_create_success_total');

// v2 metrics (Redis)
const v2CreateDuration = new Trend('v2_orders_create_duration_ms');
const v2ListDuration = new Trend('v2_orders_list_duration_ms');
const v2CreateErrors = new Counter('v2_orders_create_errors_total');
const v2ListErrors = new Counter('v2_orders_list_errors_total');
const v2CreateSuccess = new Counter('v2_orders_create_success_total');

export const options = {
  scenarios: {
    v1_list_orders: {
      executor: 'constant-vus',
      exec: 'v1ListOrdersScenario',
      vus: 200,
      duration: '1m',
      tags: { version: 'v1', backend: 'rabbitmq' }
    },
    v1_create_orders: {
      executor: 'constant-vus',
      exec: 'v1CreateOrderScenario',
      vus: 125,
      duration: '1m',
      tags: { version: 'v1', backend: 'rabbitmq' }
    },
    v2_list_orders: {
      executor: 'constant-vus',
      exec: 'v2ListOrdersScenario',
      vus: 125,
      duration: '1m',
      tags: { version: 'v2', backend: 'redis' }
    },
    v2_create_orders: {
      executor: 'constant-vus',
      exec: 'v2CreateOrderScenario',
      vus: 125,
      duration: '1m',
      tags: { version: 'v2', backend: 'redis' }
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2500'],
    v1_orders_create_duration_ms: ['p(95)<3000'],
    v1_orders_list_duration_ms: ['p(95)<1800'],
    v2_orders_create_duration_ms: ['p(95)<3000'],
    v2_orders_list_duration_ms: ['p(95)<1800']
  }
};

function randomOrderPayload() {
  const n = Math.floor(Math.random() * 1000000);
  const amount = (Math.random() * 500 + 10).toFixed(2);
  return JSON.stringify({
    customerName: `k6-user-${n}`,
    totalAmount: Number(amount)
  });
}

// ============ V1 API (RabbitMQ) ============

export function v1CreateOrderScenario() {
  const res = http.post(`${BASE_URL}/api/v1/orders`, randomOrderPayload(), {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'v1-create-order', version: 'v1' }
  });

  v1CreateDuration.add(res.timings.duration);

  const ok = check(res, {
    'v1 POST /api/v1/orders status 201': (r) => r.status === 201,
    'v1 POST returns created order': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.id && body.customerName && body.totalAmount;
      } catch {
        return false;
      }
    }
  });

  if (!ok) {
    v1CreateErrors.add(1);
  } else {
    v1CreateSuccess.add(1);
  }

  sleep(1.5);
}

export function v1ListOrdersScenario() {
  const res = http.get(`${BASE_URL}/api/v1/orders?page=1&pageSize=20`, {
    tags: { endpoint: 'v1-list-orders', version: 'v1' }
  });

  v1ListDuration.add(res.timings.duration);

  const ok = check(res, {
    'v1 GET /api/v1/orders status 200': (r) => r.status === 200,
    'v1 GET returns paged orders': (r) => {
      try {
        const body = JSON.parse(r.body);
        if (!body || typeof body !== 'object') return false;
        if (!Array.isArray(body.orders)) return false;
        if (typeof body.total !== 'number') return false;
        return body.total >= 0;
      } catch {
        return false;
      }
    },
    'v1 GET has deprecation header': (r) => r.headers['Deprecation'] === 'true'
  });

  if (!ok) {
    v1ListErrors.add(1);
  }

  sleep(0.5);
}

// ============ V2 API (Redis) ============

export function v2CreateOrderScenario() {
  const res = http.post(`${BASE_URL}/api/v2/orders`, randomOrderPayload(), {
    headers: {
      'Content-Type': 'application/json',
      'X-Contract-Version': 'v1'
    },
    tags: { endpoint: 'v2-create-order', version: 'v2' }
  });

  v2CreateDuration.add(res.timings.duration);

  const ok = check(res, {
    'v2 POST /api/v2/orders status 201': (r) => r.status === 201,
    'v2 POST returns created order': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.id && body.customerName && body.totalAmount;
      } catch {
        return false;
      }
    },
    'v2 POST has Redis backend header': (r) => r.headers['X-Backend'] === 'Redis'
  });

  if (!ok) {
    v2CreateErrors.add(1);
  } else {
    v2CreateSuccess.add(1);
  }

  sleep(1.5);
}

export function v2ListOrdersScenario() {
  const res = http.get(`${BASE_URL}/api/v2/orders?page=1&pageSize=20`, {
    headers: {
      'X-Contract-Version': 'v1'
    },
    tags: { endpoint: 'v2-list-orders', version: 'v2' }
  });

  v2ListDuration.add(res.timings.duration);

  const ok = check(res, {
    'v2 GET /api/v2/orders status 200': (r) => r.status === 200,
    'v2 GET returns paged orders': (r) => {
      try {
        const body = JSON.parse(r.body);
        if (!body || typeof body !== 'object') return false;
        if (!Array.isArray(body.orders)) return false;
        if (typeof body.total !== 'number') return false;
        return body.total >= 0;
      } catch {
        return false;
      }
    },
    'v2 GET has Redis backend header': (r) => r.headers['X-Backend'] === 'Redis'
  });

  if (!ok) {
    v2ListErrors.add(1);
  }

  sleep(0.5);
}
