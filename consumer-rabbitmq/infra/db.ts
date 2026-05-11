import sql from 'mssql';

import { SQL_SERVER_CONFIG } from '../config/appConfig';
import { OrderPayload } from '../types/order';

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

    await statement.execute({
      Id: order.Id,
      CustomerName: order.CustomerName,
      TotalAmount: order.TotalAmount,
      Status: 1,
      CreatedAtUtc: createdAt,
    });
  } finally {
    try {
      await statement.unprepare();
    } catch {
      // Do not fail the worker because cleanup failed after statement usage.
    }
  }
}