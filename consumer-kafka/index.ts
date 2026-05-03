// Consumer Kafka - Didactic Example (TypeScript)
import { Kafka, EachMessagePayload } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'consumer-kafka',
  brokers: ['kafka:9092'],
});

const consumer = kafka.consumer({ groupId: 'lab-group' });

async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'order_created', fromBeginning: true });
  console.log('Kafka Consumer waiting for messages on topic order_created...');
  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      console.log(`Received message [${topic}]:`, message.value?.toString());
    },
  });
}

run().catch(console.error);
