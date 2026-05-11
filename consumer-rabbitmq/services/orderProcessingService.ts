import { saveOrder } from '../infra/db';
import { extractOrderFromMessagePayload } from '../types/order';

export async function processRabbitOrderMessage(rawMessage: string): Promise<void> {
  const parsed: unknown = JSON.parse(rawMessage);
  const order = extractOrderFromMessagePayload(parsed);

  await saveOrder(order);
}