import { Worker, Job } from "bullmq";
import { connection } from "../lib/queue";
import { uploadGeneratedImage } from "../lib/cloudinary";
import prisma from "../lib/prisma";
import Replicate from "replicate";
import dotenv from "dotenv";
dotenv.config();

interface GenerationJobData {
  generationId: string;
  userId: string;
  inputUrl?: string;
  fullPrompt: string;
  style: string;
  roomType: string;
  projectId?: string;
}

const worker = new Worker<GenerationJobData>(
  "generation",
  async (job: Job<GenerationJobData>) => {
    const { generationId, userId, inputUrl, fullPrompt, style, roomType, projectId } = job.data;

    console.log(`[Worker] Processing generation ${generationId}`);

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });

    let output: any;

    try {
      if (inputUrl) {
        // Image-to-image: redesign uploaded room
        output = await replicate.run(
          "adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38",
          {
            input: {
              image: inputUrl,
              prompt: fullPrompt,
              negative_prompt: "low quality, blurry, distorted, ugly, cartoon, anime, sketch, watermark, text",
              guidance_scale: 15,
              num_inference_steps: 50,
              strength: 0.8,
              seed: Math.floor(Math.random() * 999999),
            },
          }
        );
      } else {
        // Text-to-image: generate from scratch
        output = await replicate.run(
          "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
          {
            input: {
              prompt: fullPrompt,
              negative_prompt: "low quality, blurry, distorted, ugly, cartoon, anime, sketch, watermark, text, people, person",
              width: 1024,
              height: 1024,
              num_outputs: 1,
              guidance_scale: 7.5,
              num_inference_steps: 50,
              seed: Math.floor(Math.random() * 999999),
            },
          }
        );
      }

      const rawUrl = Array.isArray(output) ? output[0] : output;
      if (!rawUrl) throw new Error("No output from Replicate");

      // Upload to Cloudinary for permanent storage
      const imageUrl = await uploadGeneratedImage(rawUrl.toString());

      // Auto-create project if none provided
      let finalProjectId = projectId;
      if (!finalProjectId) {
        const autoProject = await prisma.project.create({
          data: {
            userId,
            name: `${style} ${roomType}`,
            style,
            roomType,
            coverUrl: imageUrl,
          },
        });
        finalProjectId = autoProject.id;
      } else {
        // Update project cover if it doesn't have one
        await prisma.project.updateMany({
          where: { id: finalProjectId, coverUrl: null },
          data: { coverUrl: imageUrl },
        });
      }

      // Update generation record with result
      await prisma.generation.update({
        where: { id: generationId },
        data: { imageUrl, projectId: finalProjectId },
      });

      console.log(`[Worker] Generation ${generationId} complete: ${imageUrl}`);
      return { imageUrl, generationId };
    } catch (error: any) {
      console.error(`[Worker] Generation ${generationId} failed:`, error.message);

      // Refund token on failure
      await prisma.user.update({
        where: { id: userId },
        data: { tokens: { increment: 1 } },
      });

      // Mark generation as failed
      await prisma.generation.update({
        where: { id: generationId },
        data: { imageUrl: "ERROR" },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

console.log("[Worker] Generation worker started, waiting for jobs...");

export default worker;
