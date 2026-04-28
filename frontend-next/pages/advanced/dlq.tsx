import React, { useState } from 'react';
import axios from 'axios';

const DLQ: React.FC = () => {
  const [setupResult, setSetupResult] = useState('');
  const [sendResult, setSendResult] = useState('');
  const [consumeResult, setConsumeResult] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Mensagem para DLQ');

  const setupDLQ = async () => {
    setLoading(true);
    setSetupResult('');
    try {
      const res = await axios.post('/api/rabbitmq-advanced', { action: 'setup-dlq' });
      setSetupResult(res.data.info || 'DLQ configurada!');
    } catch (err: any) {
      setSetupResult('Erro: ' + (err.response?.data?.info || err.message));
    }
    setLoading(false);
  };

  const sendToDLQ = async () => {
    setLoading(true);
    setSendResult('');
    try {
      const res = await axios.post('/api/rabbitmq-advanced', { action: 'send-dlq', payload: { message } });
      setSendResult(res.data.info || 'Mensagem enviada!');
    } catch (err: any) {
      setSendResult('Erro: ' + (err.response?.data?.info || err.message));
    }
    setLoading(false);
  };

  const consumeDLQ = async () => {
    setLoading(true);
    setConsumeResult([]);
    try {
      const res = await axios.post('/api/rabbitmq-advanced', { action: 'consume-dlq' });
      setConsumeResult(res.data.messages || []);
    } catch (err: any) {
      setConsumeResult(['Erro: ' + (err.response?.data?.info || err.message)]);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h2>Dead Letter Queues (DLQ)</h2>
      <p>DLQs armazenam mensagens que não puderam ser processadas. Permitem análise e reprocessamento.</p>
      <hr style={{ margin: '24px 0' }} />
      <button onClick={setupDLQ} disabled={loading} style={{ fontWeight: 'bold' }}>Configurar DLQ</button>
      <div style={{ color: setupResult.startsWith('Erro') ? 'red' : 'green', minHeight: 24 }}>{setupResult}</div>
      <div style={{ margin: '16px 0' }}>
        <input value={message} onChange={e => setMessage(e.target.value)} style={{ width: 300 }} />
        <button onClick={sendToDLQ} disabled={loading} style={{ marginLeft: 8, fontWeight: 'bold' }}>Enviar para DLQ</button>
      </div>
      <div style={{ color: sendResult.startsWith('Erro') ? 'red' : 'green', minHeight: 24 }}>{sendResult}</div>
      <button onClick={consumeDLQ} disabled={loading} style={{ fontWeight: 'bold', marginTop: 8 }}>Consumir DLQ</button>
      <div style={{ marginTop: 16 }}>
        <b>Mensagens na DLQ:</b>
        <ul>
          {consumeResult.map((msg, i) => <li key={i}>{msg}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default DLQ;
