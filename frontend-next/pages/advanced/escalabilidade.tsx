import React, { useState } from 'react';
import axios from 'axios';

const Escalabilidade: React.FC = () => {
  const [queue, setQueue] = useState('priority_demo');
  const [consumers, setConsumers] = useState(2);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const simulate = async () => {
    setLoading(true);
    setResult('');
    try {
      const res = await axios.post('/api/rabbitmq-advanced', { action: 'simulate-consumers', payload: { queue, consumers } });
      setResult(`Mensagens processadas: ${res.data.processed}`);
    } catch (err: any) {
      setResult('Erro: ' + (err.response?.data?.info || err.message));
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h2>Escalabilidade e Concorrência</h2>
      <p>RabbitMQ permite múltiplos consumidores concorrentes para processar mensagens em paralelo.</p>
      <hr style={{ margin: '24px 0' }} />
      <div style={{ marginBottom: 8 }}>
        <label>Fila: <input value={queue} onChange={e => setQueue(e.target.value)} style={{ width: 200 }} /></label>
        <label style={{ marginLeft: 16 }}>Consumidores: <input type="number" min={1} max={20} value={consumers} onChange={e => setConsumers(Number(e.target.value))} style={{ width: 60 }} /></label>
        <button onClick={simulate} disabled={loading} style={{ marginLeft: 16, fontWeight: 'bold' }}>Simular</button>
      </div>
      <div style={{ color: result.startsWith('Erro') ? 'red' : 'green', minHeight: 24 }}>{result}</div>
      <p style={{ marginTop: 24, color: '#555' }}>
        Dica: Envie várias mensagens para a fila escolhida antes de simular múltiplos consumidores para ver o impacto.
      </p>
    </div>
  );
};

export default Escalabilidade;
