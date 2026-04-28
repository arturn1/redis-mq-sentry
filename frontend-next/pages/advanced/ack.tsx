import React, { useState } from 'react';
import axios from 'axios';

const Ack: React.FC = () => {
  const [message, setMessage] = useState('Mensagem para Ack/Nack');
  const [sendResult, setSendResult] = useState('');
  const [consumeResult, setConsumeResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [ack, setAck] = useState(true);

  const sendMessage = async () => {
    setLoading(true);
    setSendResult('');
    try {
      const res = await axios.post('/api/rabbitmq-advanced', { action: 'ack-nack-demo', payload: { message } });
      setSendResult(res.data.info || 'Mensagem enviada!');
    } catch (err: any) {
      setSendResult('Erro: ' + (err.response?.data?.info || err.message));
    }
    setLoading(false);
  };

  const consumeMessage = async () => {
    setLoading(true);
    setConsumeResult('');
    try {
      const res = await axios.post('/api/rabbitmq-advanced', { action: 'consume-ack-nack', payload: { ack } });
      setConsumeResult(`Ack: ${res.data.acked || 0}, Nack: ${res.data.nacked || 0}`);
    } catch (err: any) {
      setConsumeResult('Erro: ' + (err.response?.data?.info || err.message));
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h2>Confirmação de Mensagens (Ack/Nack)</h2>
      <p>Consumidores podem confirmar (ack) ou rejeitar (nack) mensagens. Isso garante entrega confiável.</p>
      <hr style={{ margin: '24px 0' }} />
      <div style={{ marginBottom: 8 }}>
        <input value={message} onChange={e => setMessage(e.target.value)} style={{ width: 300 }} />
        <button onClick={sendMessage} disabled={loading} style={{ marginLeft: 8, fontWeight: 'bold' }}>Enviar Mensagem</button>
      </div>
      <div style={{ color: sendResult.startsWith('Erro') ? 'red' : 'green', minHeight: 24 }}>{sendResult}</div>
      <div style={{ margin: '16px 0' }}>
        <label>
          <input type="radio" checked={ack} onChange={() => setAck(true)} /> Ack
        </label>
        <label style={{ marginLeft: 16 }}>
          <input type="radio" checked={!ack} onChange={() => setAck(false)} /> Nack
        </label>
        <button onClick={consumeMessage} disabled={loading} style={{ marginLeft: 16, fontWeight: 'bold' }}>Consumir Mensagem</button>
      </div>
      <div style={{ color: consumeResult.startsWith('Erro') ? 'red' : 'green', minHeight: 24 }}>{consumeResult}</div>
    </div>
  );
};

export default Ack;
