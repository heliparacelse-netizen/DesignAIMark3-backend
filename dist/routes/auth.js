"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../models/index");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email and password required' });
        const existing = await index_1.User.findOne({ email: email.toLowerCase() }).lean();
        if (existing)
            return res.status(400).json({ error: 'Email already in use' });
        const hashed = await bcryptjs_1.default.hash(password, 12);
        const user = await index_1.User.create({ email: email.toLowerCase(), password: hashed, name: name || email.split('@')[0], plan: 'free', tokens: 3 });
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ token, user: { id: user._id, email: user.email, name: user.name, plan: user.plan, tokens: user.tokens } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await index_1.User.findOne({ email: email.toLowerCase() }).lean();
        if (!user || !(await bcryptjs_1.default.compare(password, user.password)))
            return res.status(401).json({ error: 'Invalid credentials' });
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: user._id, email: user.email, name: user.name, plan: user.plan, tokens: user.tokens } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/me', auth_1.requireAuth, async (req, res) => {
    try {
        const user = await index_1.User.findById(req.user.id).select('-password').lean();
        res.json(user);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
