import sql from 'mssql';

import { SQL_SERVER_CONFIG } from '../config/appConfig';
import { OrderPayload } from '../types/order';

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

const poolPromise = new sql.ConnectionPool(SQL_SERVER_CONFIG)
  .connect()
  .then((pool) => {
    console.log('Connected to SQL Server');
    return pool;
  })
  .catch((error) => {
    console.error('SQL Server Connection Error:', error);
    throw error;
  });

export async function saveOrder(order: OrderPayload): Promise<void> {
  const pool = await poolPromise;
  const statement = new sql.PreparedStatement(pool);

  statement.input('Id', sql.UniqueIdentifier);
  statement.input('CustomerName', sql.NVarChar(255));
  statement.input('TotalAmount', sql.Decimal(18, 2));
  statement.input('Status', sql.Int);
  statement.input('CreatedAtUtc', sql.DateTime2);

  try {
    await statement.prepare(
      'INSERT INTO Orders (Id, CustomerName, TotalAmount, Status, CreatedAtUtc) VALUES (@Id, @CustomerName, @TotalAmount, @Status, @CreatedAtUtc)'
    );

    const createdAt =
      order.CreatedAtUtc instanceof Date ? order.CreatedAtUtc : new Date(order.CreatedAtUtc);

    if (Number.isNaN(createdAt.getTime())) {
      throw new Error('CreatedAtUtc invalido para persistencia.');
    }

    const statusInt = mapStatusStringToInt(order.Status);

    await statement.execute({
      Id: order.Id,
      CustomerName: order.CustomerName,
      TotalAmount: order.TotalAmount,
      Status: statusInt,
      CreatedAtUtc: createdAt,
    });
  } catch (err: unknown) {
    // SQL Server error 2627 = PRIMARY KEY violation
    // The API's OrderWorkflowService already inserted this order — treat as idempotent success
    if (typeof err === 'object' && err !== null && (err as { number?: number }).number === 2627) {
      console.info(`Consumer RabbitMQ: order ${order.Id} ja existe no banco (idempotente), ignorando.`);
      return;
    }
    throw err;
  } finally {
    try {
      await statement.unprepare();
    } catch {
      // Do not fail the worker because cleanup failed after statement usage.
    }
  }
}