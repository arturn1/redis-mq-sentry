import amqp from 'amqplib';
import { RABBITMQ_URL } from '../config/appConfig';

export const RabbitConnection = {
  connect: async () => amqp.connect(RABBITMQ_URL),
};