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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/analyze-room', auth_1.requireAuth, async (req, res) => {
    try {
        const { style, roomType } = req.body;
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey)
            return res.json({ suggestions: ['Add warm lighting', 'Introduce plants', 'Use a statement rug'] });
        const { default: Groq } = await Promise.resolve().then(() => __importStar(require('groq-sdk')));
        const groq = new Groq({ apiKey: groqKey });
        const response = await groq.chat.completions.create({
            model: 'llama3-8b-8192', max_tokens: 300,
            messages: [
                { role: 'system', content: 'You are an expert interior designer. Respond only with valid JSON.' },
                { role: 'user', content: `Give design tips for ${style || 'Modern'} ${roomType || 'Living Room'} as JSON: { "suggestions": ["tip1","tip2","tip3"], "colorPalette": ["#hex1","#hex2","#hex3"] }` }
            ]
        });
        const clean = (response.choices[0]?.message?.content || '{}').replace(/```json|```/g, '').trim();
        res.json(JSON.parse(clean));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/improve-prompt', auth_1.requireAuth, async (req, res) => {
    try {
        const { prompt, style, roomType } = req.body;
        if (!prompt)
            return res.status(400).json({ error: 'Prompt required' });
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey)
            return res.json({ improved: `Ultra realistic ${style || 'modern'} ${roomType || 'interior'}, ${prompt}, professional photography, 8k` });
        const { default: Groq } = await Promise.resolve().then(() => __importStar(require('groq-sdk')));
        const groq = new Groq({ apiKey: groqKey });
        const response = await groq.chat.completions.create({
            model: 'llama3-8b-8192', max_tokens: 150,
            messages: [
                { role: 'system', content: 'You are an expert interior designer. Return ONLY the improved prompt, nothing else.' },
                { role: 'user', content: `Improve this interior design prompt for ${style || 'Modern'} ${roomType || 'Living Room'}: "${prompt}"` }
            ]
        });
        res.json({ improved: response.choices[0]?.message?.content || prompt });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/chat', auth_1.requireAuth, async (req, res) => {
    try {
        const { messages } = req.body;
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey)
            return res.json({ reply: 'Add GROQ_API_KEY to enable Lumara AI chat.' });
        const { default: Groq } = await Promise.resolve().then(() => __importStar(require('groq-sdk')));
        const groq = new Groq({ apiKey: groqKey });
        const response = await groq.chat.completions.create({
            model: 'llama3-8b-8192', max_tokens: 400,
            messages: [
                { role: 'system', content: 'You are Lumara AI, an expert interior design assistant. Be concise and inspiring.' },
                ...messages
            ]
        });
        res.json({ reply: response.choices[0]?.message?.content || 'Please try again.' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
