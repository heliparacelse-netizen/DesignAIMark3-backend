import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already in use' });
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ email: email.toLowerCase(), password: hashed, name: name || email.split('@')[0], plan: 'free', tokens: 3 });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: user._id, email: user.email, name: user.name, plan: user.plan, tokens: user.tokens } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name, plan: user.plan, tokens: user.tokens } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-password');
    res.json(user);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
