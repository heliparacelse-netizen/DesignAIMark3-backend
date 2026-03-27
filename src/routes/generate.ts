import { Router } from 'express';
import { requireAuth, requireTokens } from '../middleware/auth';
import { User, Generation, Project } from '../models/index';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });

const router = Router();

const HF_API_URL = 'https://api-inference.huggingface.co/models/lllyasviel/sd-controlnet-mlsd';

async function queryHuggingFace(imageBase64: string, prompt: string): Promise<Buffer> {
  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Wait-For-Model': 'true',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        image: imageBase64,
        negative_prompt: 'low quality, blurry, ugly, distorted, watermark',
        num_inference_steps: 30,
        guidance_scale: 7.5,
        strength: 0.8,
      }
    })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HuggingFace error: ${err}`);
  }
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
    const generation: any = await Generation.create({
      userId, projectId: projectId || null, prompt: fullPrompt,
      style, roomType, inputUrl, imageUrl: null, shareToken
    });

    console.log(`[Generate] Generation created: ${generation._id}`);

    const generateImage = async () => {
      try {
        console.log(`[Generate] Calling HuggingFace API...`);

        let imageBuffer: Buffer;

        if (image) {
          const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
          imageBuffer = await queryHuggingFace(base64Data, fullPrompt);
        } else {
          const fallbackResponse = await fetch('https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800');
          const fallbackBuffer = Buffer.from(await fallbackResponse.arrayBuffer());
          const base64Fallback = fallbackBuffer.toString('base64');
          imageBuffer = await queryHuggingFace(base64Fallback, fullPrompt);
        }

        console.log(`[Generate] HuggingFace done, uploading to Cloudinary...`);

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
    res.json({
      imageUrl: generation.imageUrl,
      status: generation.imageUrl ? (generation.imageUrl === 'ERROR' ? 'failed' : 'done') : 'pending'
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
