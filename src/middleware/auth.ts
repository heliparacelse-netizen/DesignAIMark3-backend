import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/index';

export interface AuthRequest extends Request {
  user?: any;
  body: any;
  params: any;
  headers: any;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || token === 'null' || token === 'undefined') return res.status(401).json({ error: 'Invalid token' });
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const user: any = await User.findById(decoded.userId).select('-password').lean();
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = { id: user._id.toString(), email: user.email, plan: user.plan, tokens: user.tokens, name: user.name };
    next();
  } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
};

export const requireTokens = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user: any = await User.findById(req.user.id).lean();
  if (!user || user.tokens < 25) {
    return res.status(402).json({ error: 'Not enough tokens. You need 25 tokens per redesign. Upgrade your plan.', code: 'NO_TOKENS', tokensRemaining: user?.tokens || 0 });
  }
  next();
};
