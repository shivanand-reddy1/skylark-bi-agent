import { Router, Request, Response } from 'express';
import { handleChatMessage } from '../ai/agent';

export const chatRouter = Router();

chatRouter.post('/', async (req: Request, res: Response) => {
  const { message, history } = req.body as {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  if (message.trim().length > 2000) {
    res.status(400).json({ error: 'Message too long. Please keep it under 2000 characters.' });
    return;
  }

  try {
    const result = await handleChatMessage(message.trim(), history ?? []);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[CHAT ERROR]', msg);
    res.status(500).json({
      error: 'I encountered an error processing your request. Please try again.',
    });
  }
});
