import { Router } from 'express';
import { requireAuth, requireTokens } from '../middleware/auth';
import { User, Generation, Project } from '../models/index';
import crypto from 'crypto';

const router = Router();

router.post('/', requireAuth, requireTokens, async (req: any, res: any) => {
  try {
    const { image, style, roomType, prompt, projectId } = req.body;
    const userId = req.user.id;

    const hfToken = process.env.HUGGINGFACE_API_TOKEN;
    const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;

    console.log(`[Generate] HF token: ${hfToken ? 'OK' : 'MISSING'} / Cloudinary: ${cloudinaryCloudName}`);

    if (!hfToken) return res.status(500).json({ error: 'HuggingFace token not configured' });
    if (!cloudinaryApiKey) return res.status(500).json({ error: 'Cloudinary not configured' });

    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({ cloud_name: cloudinaryCloudName, api_key: cloudinaryApiKey, api_secret: cloudinaryApiSecret });

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

    // Generate with HuggingFace in background
    const generateImage = async () => {
      try {
        console.log(`[Generate] Calling HuggingFace API...`);
        const response = await fetch(
          'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${hfToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: fullPrompt,
              parameters: {
                negative_prompt: 'low quality, blurry, ugly, distorted, watermark',
                num_inference_steps: 30,
                guidance_scale: 7.5,
                width: 1024,
                height: 1024,
              }
            })
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`HuggingFace error: ${error}`);
        }

        const imageBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64}`;

        const saved: any = await cloudinary.uploader.upload(dataUrl, { folder: 'lumara/generated' });
        await Generation.findByIdAndUpdate(generation._id, { imageUrl: saved.secure_url });

        if (!projectId) {
          const proj: any = await Project.create({ userId, name: `${style} ${roomType}`, style, roomType, coverUrl: saved.secure_url });
          await Generation.findByIdAndUpdate(generation._id, { projectId: proj._id });
        }

        console.log(`[Generate] Complete! Image: ${saved.secure_url}`);
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
    res.json({
      imageUrl: generation.imageUrl,
      status: generation.imageUrl ? (generation.imageUrl === 'ERROR' ? 'failed' : 'done') : 'pending'
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
