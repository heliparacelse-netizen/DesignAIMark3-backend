import { Router } from 'express';
import { requireAuth, requireTokens } from '../middleware/auth';
import { User, Generation, Project } from '../models/index';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });

async function generateWithStability(imageBase64: string | null, prompt: string): Promise<Buffer> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) throw new Error('STABILITY_API_KEY not configured');

  const { default: FormData } = await import('form-data');
  const formData = new FormData();

  if (imageBase64) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    formData.append('image', imageBuffer, { filename: 'room.png', contentType: 'image/png' });
    formData.append('mode', 'image-to-image');
    formData.append('strength', '0.75');
  }

  formData.append('prompt', prompt);
  formData.append('negative_prompt', 'low quality, blurry, ugly, distorted, watermark, people');
  formData.append('output_format', 'png');

  const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'image/*',
      ...formData.getHeaders()
    },
    body: formData.getBuffer() as unknown as BodyInit
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Stability AI error: ${errText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

const router = Router();

router.post('/', requireAuth, requireTokens, async (req: any, res: any) => {
  try {
    const { image, style, roomType, prompt, projectId } = req.body;
    const userId = req.user.id;

    if (!process.env.STABILITY_API_KEY) return res.status(500).json({ error: 'Stability AI API key not configured' });

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
    const generation: any = await Generation.create({
      userId, projectId: projectId || null, prompt: fullPrompt,
      style, roomType, inputUrl, imageUrl: null, shareToken
    });
    console.log(`[Generate] Generation created: ${generation._id}`);

    const generateImage = async () => {
      try {
        console.log(`[Generate] Calling Stability AI...`);
        const imageBuffer = await generateWithStability(image || null, fullPrompt);

        const uploadResult: any = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: 'lumara/generated' },
            (err, result) => err ? reject(err) : resolve(result)
          ).end(imageBuffer);
        });

        await Generation.findByIdAndUpdate(generation._id, { imageUrl: uploadResult.secure_url });

        if (!projectId) {
          const proj: any = await Project.create({
            userId, name: `${style} ${roomType}`,
            style, roomType, coverUrl: uploadResult.secure_url
          });
          await Generation.findByIdAndUpdate(generation._id, { projectId: proj._id });
        }
        console.log(`[Generate] Complete! ${uploadResult.secure_url}`);
      } catch (err: any) {
        console.error(`[Generate] Error:`, err.message);
        await User.findByIdAndUpdate(userId, { $inc: { tokens: 1 } });
        await Generation.findByIdAndUpdate(generation._id, { imageUrl: 'ERROR' });
      }
    };

    generateImage();

    const updatedUser: any = await User.findById(userId).lean();
    res.json({ success: true, generationId: generation._id, tokensRemaining: (updatedUser as any)?.tokens });

  } catch (e: any) {
    console.error(`[Generate] FATAL:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/status/:id', requireAuth, async (req: any, res: any) => {
  try {
    const generation: any = await Generation.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!generation) return res.status(404).json({ error: 'Not found' });
    res.json({
      imageUrl: generation.imageUrl,
      status: generation.imageUrl ? (generation.imageUrl === 'ERROR' ? 'failed' : 'done') : 'pending'
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
