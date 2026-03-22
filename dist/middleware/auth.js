"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireTokens = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../models/index");
const requireAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token)
            return res.status(401).json({ error: 'No token' });
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await index_1.User.findById(decoded.userId).select('-password').lean();
        if (!user)
            return res.status(401).json({ error: 'User not found' });
        req.user = { id: user._id.toString(), email: user.email, plan: user.plan, tokens: user.tokens, name: user.name };
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
exports.requireAuth = requireAuth;
const requireTokens = async (req, res, next) => {
    if (!req.user)
        return res.status(401).json({ error: 'Unauthorized' });
    const user = await index_1.User.findById(req.user.id).lean();
    if (!user || user.tokens <= 0)
        return res.status(402).json({ error: 'No tokens remaining. Upgrade your plan.', code: 'NO_TOKENS' });
    next();
};
exports.requireTokens = requireTokens;
