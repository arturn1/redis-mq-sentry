// db.ts
// Simple SQL Server persistence module for consumer-redis-fast
// Uses mssql package to connect to SQL Server (docker: sqlserver)

import sql from 'mssql';

type OrderPayload = {
  id?: string;
  customerName?: string;
  totalAmount?: number;
  status?: string | number;
  createdAtUtc?: string | Date;
};

const config = {
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

export async function saveOrder(order: OrderPayload | null | undefined) {
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

  try {
    const pool = await poolPromise;
    const ps = new sql.PreparedStatement(pool);
    ps.input('Id', sql.UniqueIdentifier);
    ps.input('CustomerName', sql.NVarChar(255));
    ps.input('TotalAmount', sql.Decimal(18, 2));
    ps.input('Status', sql.NVarChar(50));
    ps.input('CreatedAtUtc', sql.DateTime2);

    await ps.prepare(
      'INSERT INTO Orders (Id, CustomerName, TotalAmount, Status, CreatedAtUtc) VALUES (@Id, @CustomerName, @TotalAmount, @Status, @CreatedAtUtc)'
    );

    await ps.execute({
      Id: order.id,
      CustomerName: order.customerName,
      TotalAmount: order.totalAmount,
      Status: String(order.status ?? ''),
      CreatedAtUtc: order.createdAtUtc,
    });

    await ps.unprepare();
    return true;
  } catch (err) {
    console.error('Erro ao salvar order no banco:', err);
    throw err;
  }
}
