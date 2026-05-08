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

app.get('/messages/:topic', async (req: Request, res: Response) => {
  const { topic } = req.params as { topic: string };
  const groupId = (req.query.groupId as string) || 'lab-group';
  const messages: Array<{
    partition: number;
    offset: string;
    timestamp: string;
    value: any;
    consumed: boolean;
  }> = [];

  try {
    const admin = kafka.admin();
    await admin.connect();

    // Get topic offsets and committed offsets for the consumer group.
    let offsets;
    try {
      offsets = await admin.fetchTopicOffsets(topic);
    } catch {
      await admin.disconnect();
      return res.json({ ok: true, messages: [] });
    }

    let groupOffsetsByPartition = new Map<number, number>();
    try {
      const groupOffsetsResponse = await admin.fetchOffsets({ groupId, topics: [topic] });
      const topicOffsets = groupOffsetsResponse.find((t) => t.topic === topic);
      for (const p of topicOffsets?.partitions ?? []) {
        const committed = Number(p.offset);
        groupOffsetsByPartition.set(p.partition, Number.isNaN(committed) ? 0 : committed);
      }
    } catch {
      // Group may not exist yet; keep offsets empty and mark all as not consumed.
      groupOffsetsByPartition = new Map<number, number>();
    }

    await admin.disconnect();

    if (!offsets || offsets.length === 0) {
      return res.json({ ok: true, messages: [] });
    }

    const consumer = kafka.consumer({ groupId: `lab-${Date.now()}` });
    await consumer.connect();

    // Seek to the beginning for all partitions
    await consumer.subscribe({ topic, fromBeginning: true });

    let messageCount = 0;
    const maxMessages = 1000; // Safety limit
    let finished = false;

    const timeout = setTimeout(async () => {
      finished = true;
    }, 5000);

    await new Promise<void>((resolve) => {
      consumer.run({
        autoCommit: false,
        eachMessage: async ({ partition, message }) => {
          if (finished) {
            resolve();
            return;
          }

          if (message.value) {
            try {
              const raw = message.value.toString();
              const parsed = (() => {
                try {
                  return JSON.parse(raw);
                } catch {
                  return raw;
                }
              })();

              messages.push({
                partition,
                offset: message.offset.toString(),
                timestamp: new Date(Number(message.timestamp || 0)).toISOString(),
                value: parsed,
                consumed: false,
              });

              messageCount++;
              if (messageCount >= maxMessages) {
                finished = true;
                resolve();
              }
            } catch (e) {
              console.error('Error processing message:', e);
            }
          }
        },
      }).catch(() => {
        finished = true;
        resolve();
      });

      // Resolve after timeout anyway
      setTimeout(() => {
        finished = true;
        resolve();
      }, 5500);
    });

    clearTimeout(timeout);
    await consumer.disconnect().catch(() => {});

    const enriched = messages
      .map((m) => {
        const committed = groupOffsetsByPartition.get(m.partition) ?? 0;
        const current = Number(m.offset);
        const consumed = !Number.isNaN(current) && current < committed;
        return { ...m, consumed };
      })
      .sort((a, b) => Number(a.offset) - Number(b.offset));

    return res.json({ ok: true, groupId, messages: enriched });
  } catch (err) {
    console.error('Error fetching messages:', err);
    return res.status(500).json({ ok: false, error: String(err), messages: [] });
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.send('Producer Kafka API rodando');
});

app.listen(5000, () => {
  console.log('Producer Kafka rodando na porta 5000');
});
