import React, { useState } from 'react';
import axios from 'axios';

const Prioridade: React.FC = () => {
  const [priorityMsg, setPriorityMsg] = useState('Mensagem com prioridade');
  const [priority, setPriority] = useState(5);
  const [priorityResult, setPriorityResult] = useState('');
  const [ttlMsg, setTtlMsg] = useState('Mensagem com TTL');
  const [ttl, setTtl] = useState(5000);
  const [ttlResult, setTtlResult] = useState('');
  const [loading, setLoading] = useState(false);

  const sendPriority = async () => {
    setLoading(true);
    setPriorityResult('');
    try {
      const res = await axios.post('/api/rabbitmq-advanced', { action: 'send-priority', payload: { message: priorityMsg, priority } });
      setPriorityResult(res.data.info || 'Mensagem enviada!');
    } catch (err: any) {
      setPriorityResult('Erro: ' + (err.response?.data?.info || err.message));
    }
    setLoading(false);
  };

  const sendTtl = async () => {
    setLoading(true);
    setTtlResult('');
    try {
      const res = await axios.post('/api/rabbitmq-advanced', { action: 'send-ttl', payload: { message: ttlMsg, ttl } });
      setTtlResult(res.data.info || 'Mensagem enviada!');
    } catch (err: any) {
      setTtlResult('Erro: ' + (err.response?.data?.info || err.message));
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h2>Prioridade e TTL</h2>
      <p>Filas podem ter prioridade de mensagens e tempo de vida (TTL). Mensagens com maior prioridade são processadas antes.</p>
      <hr style={{ margin: '24px 0' }} />
      <h3>Mensagem com Prioridade</h3>
      <div style={{ marginBottom: 8 }}>
        <input value={priorityMsg} onChange={e => setPriorityMsg(e.target.value)} style={{ width: 300 }} />
        <input type="number" min={0} max={10} value={priority} onChange={e => setPriority(Number(e.target.value))} style={{ width: 60, marginLeft: 8 }} />
        <button onClick={sendPriority} disabled={loading} style={{ marginLeft: 8, fontWeight: 'bold' }}>Enviar</button>
      </div>
      <div style={{ color: priorityResult.startsWith('Erro') ? 'red' : 'green', minHeight: 24 }}>{priorityResult}</div>
      <h3 style={{ marginTop: 24 }}>Mensagem com TTL</h3>
      <div style={{ marginBottom: 8 }}>
        <input value={ttlMsg} onChange={e => setTtlMsg(e.target.value)} style={{ width: 300 }} />
        <input type="number" min={100} step={100} value={ttl} onChange={e => setTtl(Number(e.target.value))} style={{ width: 80, marginLeft: 8 }} /> ms
        <button onClick={sendTtl} disabled={loading} style={{ marginLeft: 8, fontWeight: 'bold' }}>Enviar</button>
      </div>
      <div style={{ color: ttlResult.startsWith('Erro') ? 'red' : 'green', minHeight: 24 }}>{ttlResult}</div>
    </div>
  );
};

export default Prioridade;
