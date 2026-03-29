import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    const { messages } = req.body;
    console.log('[Roomvera Chat] Request received');
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.json({ reply: 'AI temporarily waking up (Render cold start). Please try again in 30 seconds.' });
    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: groqKey });
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 500,
      messages: [
        { role: 'system', content: 'You are Roomvera AI, an expert interior design assistant. Help users with room redesign, furniture suggestions, style advice, and prompt improvement. Be concise, practical, and inspiring.' },
        ...messages
      ]
    });
    const reply = response.choices[0]?.message?.content || 'Please try again.';
    console.log('[Roomvera Chat] Response sent');
    res.json({ reply });
  } catch (e: any) {
    console.error('[Roomvera Chat] Error:', e.message);
    res.json({ reply: 'AI temporarily waking up (Render cold start). Please try again in 30 seconds.' });
  }
});

export default router;
