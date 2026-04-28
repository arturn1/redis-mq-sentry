import React from 'react';

const AdvancedIndex: React.FC = () => (
  <div style={{ padding: 32 }}>
    <h1>RabbitMQ - Funcionalidades Avançadas</h1>
    <ul>
      <li><a href="/advanced/exchanges">Exchanges & Roteamento</a></li>
      <li><a href="/advanced/dlq">Dead Letter Queues (DLQ)</a></li>
      <li><a href="/advanced/ack">Confirmação de Mensagens (Ack/Nack)</a></li>
      <li><a href="/advanced/prioridade">Prioridade e TTL</a></li>
      <li><a href="/advanced/escalabilidade">Escalabilidade e Concorrência</a></li>
    </ul>
  </div>
);

export default AdvancedIndex;
