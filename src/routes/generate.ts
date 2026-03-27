import { Router } from 'express';
import { requireAuth, requireTokens } from '../middleware/auth';
import { User, Generation, Project } from '../models/index';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });

const router = Router();

async function generateWithHuggingFace(prompt: string): Promise<Buffer> {
  const HF_TOKEN = process.env.HF_API_TOKEN;
  const response = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json', 'x-wait-for-model': 'true' },
    body: JSON.stringify({ inputs: prompt })
  });
  if (!response.ok) throw new Error(`HuggingFace error: ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

router.post('/', requireAuth, requireTokens, async (req: any, res: any) => {
  try {
    const { image, style, roomType, prompt, projectId } = req.body;
    const userId = req.user.id;

    if (!process.env.HF_API_TOKEN) return res.status(500).json({ error: 'HuggingFace API token not configured' });
    if (!process.env.CLOUDINARY_API_KEY) return res.status(500).json({ error: 'Cloudinary not configured' });

    let inputUrl: string | undefined;
    if (image) {
      const uploaded: any = await cloudinary.uploader.upload(image, { folder: 'lumara/inputs' });
      inputUrl = uploaded.secure_url;
      console.log(`[Generate] Input uploaded: ${inputUrl}`);
    }

    const fullPrompt = prompt
      ? `${prompt}, ultra realistic interior design, ${style} style ${roomType}, professional photography, 8k`
      : `ultra realistic interior design, ${style} style ${roomType}, professional interior photography, realistic lighting, 8k`;

    await User.findByIdAndUpdate(userId, { $inc: { tokens: -1 } });
    const shareToken = crypto.randomBytes(16).toString('hex');
    const generation: any = await Generation.create({ userId, projectId: projectId || null, prompt: fullPrompt, style, roomType, inputUrl, imageUrl: null, shareToken });
    console.log(`[Generate] Generation created: ${generation._id}`);

    const generateImage = async () => {
      try {
        console.log(`[Generate] Calling HuggingFace FLUX.1-schnell...`);
        const imageBuffer = await generateWithHuggingFace(fullPrompt);
        const uploadResult: any = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: 'lumara/generated', transformation: [{ quality: 'auto', fetch_format: 'auto', width: 1024, crop: 'limit' }] },
            (err, result) => err ? reject(err) : resolve(result)
          ).end(imageBuffer);
        });
        await Generation.findByIdAndUpdate(generation._id, { imageUrl: uploadResult.secure_url });
        if (!projectId) {
          const proj: any = await Project.create({ userId, name: `${style} ${roomType}`, style, roomType, coverUrl: uploadResult.secure_url });
          await Generation.findByIdAndUpdate(generation._id, { projectId: proj._id });
        }
        console.log(`[Generate] Complete!`);
      } catch (err: any) {
        console.error(`[Generate] Error:`, err.message);
        await User.findByIdAndUpdate(userId, { $inc: { tokens: 1 } });
        await Generation.findByIdAndUpdate(generation._id, { imageUrl: 'ERROR' });
      }
    };

    generateImage();
    const updatedUser: any = await User.findById(userId).lean();
    res.json({ success: true, generationId: generation._id, tokensRemaining: updatedUser?.tokens });

  } catch (e: any) {
    console.error(`[Generate] FATAL:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/status/:id', requireAuth, async (req: any, res: any) => {
  try {
    const generation: any = await Generation.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!generation) return res.status(404).json({ error: 'Not found' });
    res.json({ imageUrl: generation.imageUrl, status: generation.imageUrl ? (generation.imageUrl === 'ERROR' ? 'failed' : 'done') : 'pending' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
