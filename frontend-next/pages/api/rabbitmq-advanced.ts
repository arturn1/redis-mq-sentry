import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// API para interações avançadas com RabbitMQ
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { action, payload } = req.body;
  try {
    // Encaminha para o backend (bull-board-app)
    const backendRes = await axios.post('http://bull-board-app:4000/api/rabbitmq-advanced', { action, payload });
    res.status(200).json(backendRes.data);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao enviar para backend avançado' });
  }
}
