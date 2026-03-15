import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { User } from '../models/index';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('tokens plan');
    res.json({ tokens: user?.tokens || 0, plan: user?.plan || 'free' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
