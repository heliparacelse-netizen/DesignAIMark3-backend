import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { Generation } from '../models/index';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const generations = await Generation.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(50);
    res.json(generations);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await Generation.deleteOne({ _id: req.params.id, userId: req.user!.id });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
