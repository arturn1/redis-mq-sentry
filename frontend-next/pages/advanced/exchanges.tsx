import React, { useState } from 'react';
import axios from 'axios';

const exchangeTypes = [
  { value: 'direct', label: 'Direct' },
  { value: 'topic', label: 'Topic' },
  { value: 'fanout', label: 'Fanout' },
  { value: 'headers', label: 'Headers' },
];

const Exchanges: React.FC = () => {
  const [exchange, setExchange] = useState('direct_demo');
  const [type, setType] = useState('direct');
  const [routingKey, setRoutingKey] = useState('demo.key');
  const [message, setMessage] = useState('Olá, RabbitMQ!');
  const [headers, setHeaders] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    setLoading(true);
    setResult('');
    try {
      const parsedHeaders = headers ? JSON.parse(headers) : undefined;
      const res = await axios.post('/api/rabbitmq-advanced', {
        action: 'send-exchange',
        payload: { exchange, type, routingKey, message, headers: parsedHeaders },
      });
      setResult(res.data.info || 'Mensagem enviada!');
    } catch (err: any) {
      setResult('Erro: ' + (err.response?.data?.info || err.message));
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h2>Exchanges & Roteamento</h2>
      <p>Exchanges são responsáveis por rotear mensagens para filas com base em regras. Tipos principais:</p>
      <ul>
        <li><b>Direct:</b> Roteia por chave exata.</li>
        <li><b>Topic:</b> Roteia por padrão (wildcards).</li>
        <li><b>Fanout:</b> Envia para todas as filas ligadas.</li>
        <li><b>Headers:</b> Roteia por cabeçalhos.</li>
      </ul>
      <hr style={{ margin: '24px 0' }} />
      <h3>Enviar mensagem para Exchange</h3>
      <div style={{ marginBottom: 8 }}>
        <label>Exchange: <input value={exchange} onChange={e => setExchange(e.target.value)} /></label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label>Tipo: 
          <select value={type} onChange={e => setType(e.target.value)}>
            {exchangeTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label>Routing Key: <input value={routingKey} onChange={e => setRoutingKey(e.target.value)} /></label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label>Mensagem: <input value={message} onChange={e => setMessage(e.target.value)} style={{ width: 300 }} /></label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label>Headers (JSON): <input value={headers} onChange={e => setHeaders(e.target.value)} placeholder='{"x-match":"all"}' style={{ width: 200 }} /></label>
      </div>
      <button onClick={sendMessage} disabled={loading} style={{ fontWeight: 'bold' }}>
        {loading ? 'Enviando...' : 'Enviar Mensagem'}
      </button>
      <div style={{ marginTop: 16, minHeight: 24, color: result.startsWith('Erro') ? 'red' : 'green' }}>{result}</div>
    </div>
  );
};

export default Exchanges;
