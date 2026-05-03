import amqp from 'amqplib';

export const RabbitService = {
  connect: async () => amqp.connect('amqp://rabbitmq'),
  // Adicione métodos específicos conforme necessário
};
