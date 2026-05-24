// db.ts
// Simple SQL Server persistence module for consumer-redis-fast
// Uses mssql package to connect to SQL Server (docker: sqlserver)

import sql from 'mssql';
import type { OrderPayload } from '../types/order';

const config: sql.config = {
  user: 'sa',
  password: 'Your_strong_password123',
  server: 'sqlserver',
  port: 1433,
  database: 'OrdersDb',
  options: {
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

function mapStatusStringToInt(status?: string | number): number {
  // Default to Created = 1 if status not provided
  if (!status) return 1;

  // If already a number, return it
  if (typeof status === 'number') {
    return status;
  }

  const statusMap: Record<string, number> = {
    'Created': 1,
    'Enqueued': 2,
    'Compensated': 3,
  };

  return statusMap[status] ?? 1;
}

// Create a single pool instance for the app
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Connected to SQL Server');
    return pool;
  })
  .catch(err => {
    console.error('SQL Server Connection Error:', err);
    throw err;
  });

function normalizeCreatedAtUtc(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Order payload invalido: CreatedAtUtc invalido. Valor=${String(value)}`);
  }

  return date;
}

export async function saveOrder(order: OrderPayload | null | undefined): Promise<boolean> {
  if (!order?.id) {
    throw new Error(`Order payload invalido: id ausente. Payload=${JSON.stringify(order)}`);
  }

  if (!order.customerName) {
    throw new Error(`Order payload invalido: customerName ausente. Id=${order.id}`);
  }

  if (typeof order.totalAmount !== 'number') {
    throw new Error(`Order payload invalido: totalAmount ausente ou invalido. Id=${order.id}`);
  }

  if (!order.createdAtUtc) {
    throw new Error(`Order payload invalido: createdAtUtc ausente. Id=${order.id}`);
  }

  const createdAtUtc = normalizeCreatedAtUtc(order.createdAtUtc);

  let ps: sql.PreparedStatement | null = null;

  try {
    const pool = await poolPromise;
    ps = new sql.PreparedStatement(pool);
    ps.input('Id', sql.UniqueIdentifier);
    ps.input('CustomerName', sql.NVarChar(255));
    ps.input('TotalAmount', sql.Decimal(18, 2));
    ps.input('Status', sql.Int);
    ps.input('CreatedAtUtc', sql.DateTime2);

    await ps.prepare(
      'INSERT INTO Orders (Id, CustomerName, TotalAmount, Status, CreatedAtUtc) VALUES (@Id, @CustomerName, @TotalAmount, @Status, @CreatedAtUtc)'
    );

    const statusInt = mapStatusStringToInt(order.status);

    await ps.execute({
      Id: order.id,
      CustomerName: order.customerName,
      TotalAmount: order.totalAmount,
      Status: statusInt,
      CreatedAtUtc: createdAtUtc,
    });

    return true;
  } catch (err: unknown) {
    // SQL Server error 2627 = PRIMARY KEY violation
    // The API's OrderWorkflowService already inserted this order — treat as idempotent success
    if (typeof err === 'object' && err !== null && (err as { number?: number }).number === 2627) {
      console.info(`Consumer Redis Fast: order ${order.id} ja existe no banco (idempotente), ignorando.`);
      return true;
    }
    console.error('Erro ao salvar order no banco:', err);
    throw err;
  } finally {
    if (ps) {
      await ps.unprepare().catch(() => undefined);
    }
  }
}
