// Producer Kafka - API simples para publicar mensagens em tópicos Kafka
// Uso didático para laboratório de arquitetura distribuída

import express, { Request, Response } from 'express';
import { Kafka } from 'kafkajs';

const app = express();
app.use(express.json());

const kafka = new Kafka({
  clientId: 'producer-kafka',
  brokers: ['kafka:9092'],
});
const producer = kafka.producer();

app.post('/produce', async (req: Request, res: Response) => {
  const { topic, message } = req.body as { topic: string; message: any };
  if (!topic || !message) return res.status(400).json({ error: 'topic e message obrigatórios' });
  try {
    await producer.connect();
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
    await producer.disconnect();
    res.json({ ok: true, info: `Mensagem enviada para o tópico ${topic}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.send('Producer Kafka API rodando');
});

app.listen(5000, () => {
  console.log('Producer Kafka rodando na porta 5000');
});
