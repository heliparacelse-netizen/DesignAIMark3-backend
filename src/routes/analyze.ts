import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import Groq from 'groq-sdk';

const router = Router();
const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY! });

router.post('/analyze-room', requireAuth, async (req: any, res: any) => {
  try {
    const { style, roomType } = req.body;
    if (!process.env.GROQ_API_KEY) return res.json({ suggestions: ['Add warm lighting', 'Introduce plants', 'Use a statement rug'] });
    const groq = getGroq();
    const response = await groq.chat.completions.create({
      model: 'llama3-8b-8192', max_tokens: 300,
      messages: [
        { role: 'system', content: 'You are an expert interior designer. Respond only with valid JSON.' },
        { role: 'user', content: `Analyze a ${style||'Modern'} ${roomType||'Living Room'} and give JSON: { "suggestions": ["tip1","tip2","tip3"], "colorPalette": ["#hex1","#hex2","#hex3"] }` }
      ]
    });
    const clean = (response.choices[0]?.message?.content || '{}').replace(/```json|```/g, '').trim();
    res.json(JSON.parse(clean));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/improve-prompt', requireAuth, async (req: any, res: any) => {
  try {
    const { prompt, style, roomType } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    if (!process.env.GROQ_API_KEY) return res.json({ improved: `Ultra realistic ${style||'modern'} ${roomType||'interior'}, ${prompt}, professional photography, 8k` });
    const groq = getGroq();
    const response = await groq.chat.completions.create({
      model: 'llama3-8b-8192', max_tokens: 150,
      messages: [
        { role: 'system', content: 'You are an expert interior designer. Return ONLY the improved prompt, nothing else.' },
        { role: 'user', content: `Improve this prompt for ${style||'Modern'} ${roomType||'Living Room'}: "${prompt}"` }
      ]
    });
    res.json({ improved: response.choices[0]?.message?.content || prompt });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/chat', requireAuth, async (req: any, res: any) => {
  try {
    const { messages } = req.body;
    if (!process.env.GROQ_API_KEY) return res.json({ reply: 'Add GROQ_API_KEY to enable Lumara AI chat.' });
    const groq = getGroq();
    const response = await groq.chat.completions.create({
      model: 'llama3-8b-8192', max_tokens: 400,
      messages: [{ role: 'system', content: 'You are Lumara AI, an expert interior design assistant. Be concise and inspiring.' }, ...messages]
    });
    res.json({ reply: response.choices[0]?.message?.content || 'Please try again.' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
