import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { type } = req.body;
  try {
    // Envia para o backend (bull-board-app)
    const backendRes = await axios.post('http://bull-board-app:4000/api/send', { type });
    res.status(200).json({ message: backendRes.data.message });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao enviar para backend' });
  }
}
