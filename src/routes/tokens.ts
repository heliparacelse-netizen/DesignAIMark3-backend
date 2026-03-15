import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/index';

const router = Router();

router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const user: any = await User.findById(req.user.id).select('tokens plan').lean();
    res.json({ tokens: user?.tokens || 0, plan: user?.plan || 'free' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
