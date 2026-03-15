import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/index';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; plan: string; tokens: number; name: string };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = { id: user._id.toString(), email: user.email, plan: user.plan, tokens: user.tokens, name: user.name };
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
};

export const requireTokens = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await User.findById(req.user.id);
  if (!user || user.tokens <= 0) return res.status(402).json({ error: 'No tokens remaining. Upgrade your plan.', code: 'NO_TOKENS' });
  next();
};
