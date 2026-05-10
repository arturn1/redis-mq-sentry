// db.ts
// SQL Server persistence module for consumer-rabbitmq
// Uses mssql package to connect to SQL Server (docker: sqlserver)

import sql from 'mssql';

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

export async function saveOrder(order: any) {
  try {
    const pool = await poolPromise;
    const ps = new sql.PreparedStatement(pool);
    ps.input('Id', sql.UniqueIdentifier);
    ps.input('CustomerName', sql.NVarChar(255));
    ps.input('TotalAmount', sql.Decimal(18, 2));
    ps.input('Status', sql.Int);
    ps.input('CreatedAtUtc', sql.DateTime2);

    await ps.prepare(
      'INSERT INTO Orders (Id, CustomerName, TotalAmount, Status, CreatedAtUtc) VALUES (@Id, @CustomerName, @TotalAmount, @Status, @CreatedAtUtc)'
    );

    await ps.execute({
      Id: order.Id,
      CustomerName: order.CustomerName,
      TotalAmount: order.TotalAmount,
      Status: 1,
      CreatedAtUtc: order.CreatedAtUtc,
    });

    await ps.unprepare();
    return true;
  } catch (err) {
    console.error('Erro ao salvar order no banco:', err);
    throw err;
  }
}
