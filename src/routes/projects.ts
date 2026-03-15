import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { Project } from '../models/index';
import crypto from 'crypto';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await Project.find({ userId: req.user!.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, style, roomType } = req.body;
    const project = await Project.create({ userId: req.user!.id, name: name || 'Untitled', style: style || 'Modern', roomType: roomType || 'Living Room', shareToken: crypto.randomBytes(16).toString('hex') });
    res.status(201).json(project);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await Project.deleteOne({ _id: req.params.id, userId: req.user!.id });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
