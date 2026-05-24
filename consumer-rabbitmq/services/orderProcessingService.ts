import { saveOrder } from '../infra/db';
import { extractOrderFromMessagePayload } from '../types/order';

export async function processRabbitOrderMessage(rawMessage: string): Promise<void> {
  const parsed: unknown = JSON.parse(rawMessage);
  const order = extractOrderFromMessagePayload(parsed);

  if (order.Status) {
    console.log(`Consumer RabbitMQ: order ${order.Id} status=${order.Status}`);
  }

  await saveOrder(order);
}