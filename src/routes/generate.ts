import { Router } from 'express';
import { requireAuth, requireTokens } from '../middleware/auth';
import { User, Generation, Project } from '../models/index';
import { v2 as cloudinary } from 'cloudinary';
import Replicate from 'replicate';
import crypto from 'crypto';

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });

const router = Router();

router.post('/', requireAuth, requireTokens, async (req: any, res: any) => {
  try {
    const { image, style, roomType, prompt, projectId } = req.body;
    const userId = req.user.id;

    let inputUrl: string | undefined;
    if (image) {
      const uploaded: any = await cloudinary.uploader.upload(image, { folder: 'lumara/inputs' });
      inputUrl = uploaded.secure_url;
    }

    const fullPrompt = prompt
      ? `${prompt}, ultra realistic interior design, ${style} style ${roomType}, professional photography, 8k`
      : `ultra realistic interior design, ${style} style ${roomType}, professional interior photography, realistic lighting, 8k`;

    await User.findByIdAndUpdate(userId, { $inc: { tokens: -1 } });

    const shareToken = crypto.randomBytes(16).toString('hex');
    const generation: any = await Generation.create({ userId, projectId: projectId || null, prompt: fullPrompt, style, roomType, inputUrl, imageUrl: null, shareToken });

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });
    replicate.run('adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38', {
      input: {
        image: inputUrl || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
        prompt: fullPrompt,
        negative_prompt: 'low quality, blurry, ugly',
        guidance_scale: 15,
        num_inference_steps: 50,
        strength: 0.8
      }
    }).then(async (output: any) => {
      const rawUrl = Array.isArray(output) ? output[0] : output;
      const saved: any = await cloudinary.uploader.upload(rawUrl.toString(), { folder: 'lumara/generated' });
      await Generation.findByIdAndUpdate(generation._id, { imageUrl: saved.secure_url });
      if (!projectId) {
        const proj: any = await Project.create({ userId, name: `${style} ${roomType}`, style, roomType, coverUrl: saved.secure_url });
        await Generation.findByIdAndUpdate(generation._id, { projectId: proj._id });
      }
    }).catch(async () => {
      await User.findByIdAndUpdate(userId, { $inc: { tokens: 1 } });
      await Generation.findByIdAndUpdate(generation._id, { imageUrl: 'ERROR' });
    });

    const updatedUser: any = await User.findById(userId).lean();
    res.json({ success: true, generationId: generation._id, tokensRemaining: updatedUser?.tokens });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/status/:id', requireAuth, async (req: any, res: any) => {
  try {
    const generation: any = await Generation.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!generation) return res.status(404).json({ error: 'Not found' });
    res.json({ imageUrl: generation.imageUrl, status: generation.imageUrl ? (generation.imageUrl === 'ERROR' ? 'failed' : 'done') : 'pending' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
