import React, { useState } from 'react';
import axios from 'axios';

const quantities = [10, 100, 1000, 10000, 100000];
const types = [
  { value: 'redis-fast', label: 'Redis (rápido)' },
  { value: 'redis-slow', label: 'Redis (lento)' },
  { value: 'rabbitmq', label: 'RabbitMQ' },
];

const Home: React.FC = () => {
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedType, setSelectedType] = useState<string>('redis-fast');
  const [selectedQty, setSelectedQty] = useState<number>(10);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [errorCount, setErrorCount] = useState<number>(0);

  const stressTest = async () => {
    setLoading(true);
    setResponse('');
    setSuccessCount(0);
    setErrorCount(0);
    const promises = Array.from({ length: selectedQty }).map(async () => {
      try {
        await axios.post('/api/send', { type: selectedType });
        setSuccessCount((c) => c + 1);
      } catch {
        setErrorCount((c) => c + 1);
      }
    });
    await Promise.all(promises);
    setLoading(false);
    setResponse(`Enviadas ${selectedQty} requisições para ${types.find(t => t.value === selectedType)?.label}. Sucesso: ${successCount + 1}, Erros: ${errorCount}`);
  };

  return (
    <div style={{ padding: 32 }}>
      <h1>Frontend Next.js</h1>
      <div style={{ marginBottom: 16 }}>
        <label>Tipo:&nbsp;
          <select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
            {types.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        &nbsp;&nbsp;
        <label>Quantidade:&nbsp;
          <select value={selectedQty} onChange={e => setSelectedQty(Number(e.target.value))}>
            {quantities.map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </label>
        &nbsp;&nbsp;
        <button onClick={stressTest} disabled={loading} style={{ fontWeight: 'bold' }}>
          Stressar
        </button>
      </div>
      <div style={{ marginTop: 24 }}>
        <a href="http://localhost:4000/bull-board" target="_blank" rel="noopener noreferrer">Acessar Bull-board</a>
      </div>
      <div style={{ marginTop: 24 }}>
        <a href="http://localhost:15672" target="_blank" rel="noopener noreferrer">Acessar RabbitMQ Management</a>
      </div>
      <div style={{ marginTop: 32, minHeight: 40 }}>
        {loading ? (
          <span>Processando... Sucesso: {successCount} | Erros: {errorCount}</span>
        ) : (
          response
        )}
      </div>
    </div>
  );
};

export default Home;
