import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    const { messages } = req.body;
    console.log('[Chat] Request received, messages:', messages?.length);

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.json({ reply: 'AI temporarily waking up (Render cold start). Please try again in a moment.' });
    }

    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: groqKey });

    const response = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: 'You are Roomvera AI, an expert interior design assistant. Help users with room analysis, furniture suggestions, design prompts, style advice, and decoration trends. Be concise, practical, and inspiring. Always relate to interior design.'
        },
        ...messages
      ]
    });

    const reply = response.choices[0]?.message?.content || 'Please try again.';
    console.log('[Chat] Response sent, length:', reply.length);
    res.json({ reply });
  } catch (e: any) {
    console.error('[Chat] Error:', e.message);
    res.json({ reply: 'AI temporarily waking up (Render cold start). Please try again in a moment.' });
  }
});

export default router;
