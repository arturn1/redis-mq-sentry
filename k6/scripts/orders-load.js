import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.ORDERS_API_URL || 'http://orders-api-dotnet:8080';

const createOrderDuration = new Trend('orders_create_duration_ms');
const listOrdersDuration = new Trend('orders_list_duration_ms');
const createOrderErrors = new Counter('orders_create_errors_total');
const listOrdersErrors = new Counter('orders_list_errors_total');

export const options = {
  scenarios: {
    // create_orders: {
    //   executor: 'ramping-vus',
    //   exec: 'createOrderScenario',
    //   startVUs: 0,
    //   stages: [
    //     { duration: '1m', target: 1 },
    //     // { duration: '1m', target: 75 },
    //     // { duration: '1m30s', target: 150 },
    //     // { duration: '2m', target: 220 },
    //     // { duration: '1m', target: 300 },
    //     // { duration: '45s', target: 0 }
    //   ],
    //   gracefulRampDown: '20s'
    // },
    list_orders: {
      executor: 'constant-vus',
      exec: 'listOrdersScenario',
      vus: 1000,
      duration: '1m'
    },
    create_orders: {
      executor: 'constant-vus',
      exec: 'createOrderScenario',
      vus: 1000,
      duration: '1m'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.06'],
    http_req_duration: ['p(95)<2500'],
    orders_create_duration_ms: ['p(95)<3000'],
    orders_list_duration_ms: ['p(95)<1800']
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

export function createOrderScenario() {
  const res = http.post(`${BASE_URL}/api/orders`, randomOrderPayload(), {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'create-order' }
  });

  createOrderDuration.add(res.timings.duration);

  const ok = check(res, {
    'POST /api/orders status 201': (r) => r.status === 201
  });

  if (!ok) {
    createOrderErrors.add(1);
  }

  sleep(0.5);
}

export function listOrdersScenario() {
  const res = http.get(`${BASE_URL}/api/orders?page=1&pageSize=20`, {
    tags: { endpoint: 'list-orders' }
  });

  listOrdersDuration.add(res.timings.duration);

  const ok = check(res, {
    'GET /api/orders status 200': (r) => r.status === 200,
    'GET /api/orders returns paged object': (r) => {
      try {
        const body = JSON.parse(r.body);
        if (!body || typeof body !== 'object') return false;
        if (!Array.isArray(body.orders)) return false;
        if (typeof body.total !== 'number') return false;
        return body.total >= body.orders.length;
      } catch {
        return false;
      }
    }
  });

  if (!ok) {
    listOrdersErrors.add(1);
  }

  sleep(0.5);
}
