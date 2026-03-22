"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const index_1 = require("../models/index");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
router.post('/', auth_1.requireAuth, auth_1.requireTokens, async (req, res) => {
    try {
        const { image, style, roomType, prompt, projectId } = req.body;
        const userId = req.user.id;
        const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
        const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
        const replicateToken = process.env.REPLICATE_API_TOKEN;
        console.log(`[Generate] cloudinary: ${cloudinaryCloudName} / replicate: ${replicateToken ? replicateToken.slice(0, 5) : 'MISSING'}`);
        if (!cloudinaryApiKey || !cloudinaryApiSecret || !cloudinaryCloudName) {
            return res.status(500).json({ error: 'Cloudinary not configured' });
        }
        if (!replicateToken) {
            return res.status(500).json({ error: 'Replicate API token not configured' });
        }
        const { v2: cloudinary } = await Promise.resolve().then(() => __importStar(require('cloudinary')));
        cloudinary.config({ cloud_name: cloudinaryCloudName, api_key: cloudinaryApiKey, api_secret: cloudinaryApiSecret });
        let inputUrl;
        if (image) {
            const uploaded = await cloudinary.uploader.upload(image, { folder: 'lumara/inputs' });
            inputUrl = uploaded.secure_url;
            console.log(`[Generate] Input uploaded: ${inputUrl}`);
        }
        const fullPrompt = prompt
            ? `${prompt}, ultra realistic interior design, ${style} style ${roomType}, professional photography, 8k`
            : `ultra realistic interior design, ${style} style ${roomType}, professional interior photography, realistic lighting, 8k`;
        await index_1.User.findByIdAndUpdate(userId, { $inc: { tokens: -1 } });
        const shareToken = crypto_1.default.randomBytes(16).toString('hex');
        const generation = await index_1.Generation.create({
            userId, projectId: projectId || null, prompt: fullPrompt,
            style, roomType, inputUrl, imageUrl: null, shareToken
        });
        console.log(`[Generate] Generation created: ${generation._id}`);
        const { default: Replicate } = await Promise.resolve().then(() => __importStar(require('replicate')));
        const replicate = new Replicate({ auth: replicateToken });
        replicate.run('adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38', {
            input: {
                image: inputUrl || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
                prompt: fullPrompt,
                negative_prompt: 'low quality, blurry, ugly, distorted',
                guidance_scale: 15,
                num_inference_steps: 50,
                strength: 0.8
            }
        }).then(async (output) => {
            const rawUrl = Array.isArray(output) ? output[0] : output;
            console.log(`[Generate] Replicate done: ${rawUrl}`);
            const saved = await cloudinary.uploader.upload(rawUrl.toString(), { folder: 'lumara/generated' });
            await index_1.Generation.findByIdAndUpdate(generation._id, { imageUrl: saved.secure_url });
            if (!projectId) {
                const proj = await index_1.Project.create({ userId, name: `${style} ${roomType}`, style, roomType, coverUrl: saved.secure_url });
                await index_1.Generation.findByIdAndUpdate(generation._id, { projectId: proj._id });
            }
            console.log(`[Generate] Complete!`);
        }).catch(async (err) => {
            console.error(`[Generate] Replicate error:`, err.message);
            await index_1.User.findByIdAndUpdate(userId, { $inc: { tokens: 1 } });
            await index_1.Generation.findByIdAndUpdate(generation._id, { imageUrl: 'ERROR' });
        });
        const updatedUser = await index_1.User.findById(userId).lean();
        res.json({ success: true, generationId: generation._id, tokensRemaining: updatedUser?.tokens });
    }
    catch (e) {
        console.error(`[Generate] FATAL:`, e.message);
        res.status(500).json({ error: e.message });
    }
});
router.get('/status/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const generation = await index_1.Generation.findOne({ _id: req.params.id, userId: req.user.id }).lean();
        if (!generation)
            return res.status(404).json({ error: 'Not found' });
        res.json({
            imageUrl: generation.imageUrl,
            status: generation.imageUrl ? (generation.imageUrl === 'ERROR' ? 'failed' : 'done') : 'pending'
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
