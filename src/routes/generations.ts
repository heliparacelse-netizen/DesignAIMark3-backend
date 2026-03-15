import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { Generation } from '../models/index';

const router = Router();

router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const generations = await Generation.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json(generations);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req: any, res: any) => {
  try {
    await Generation.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
