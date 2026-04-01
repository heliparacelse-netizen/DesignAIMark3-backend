import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/index';

const router = Router();

router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    const { messages } = req.body;
    const userId = req.user.id;

    const user: any = await User.findById(userId).lean();
    if (!user || user.tokens < 15) {
      return res.status(402).json({ error: 'Not enough tokens. AI chat costs 15 tokens per message.', code: 'NO_TOKENS', tokensRemaining: user?.tokens || 0 });
    }

    await User.findByIdAndUpdate(userId, { $inc: { tokens: -15 } });
    console.log(`[Roomvera Chat] User ${userId} — 15 tokens deducted`);

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      await User.findByIdAndUpdate(userId, { $inc: { tokens: 15 } });
      return res.json({ reply: 'AI temporarily waking up (Render cold start). Please try again in 30 seconds.' });
    }

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
    const updatedUser: any = await User.findById(userId).lean();
    console.log(`[Roomvera Chat] Response sent — tokens left: ${updatedUser?.tokens}`);
    res.json({ reply, tokensRemaining: updatedUser?.tokens });
  } catch (e: any) {
    console.error('[Roomvera Chat] Error:', e.message);
    await User.findByIdAndUpdate(req.user?.id, { $inc: { tokens: 15 } }).catch(() => {});
    res.json({ reply: 'AI temporarily unavailable. Please try again.' });
  }
});

export default router;
