"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const index_1 = require("../models/index");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const projects = await index_1.Project.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
        res.json(projects);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { name, style, roomType } = req.body;
        const project = await index_1.Project.create({ userId: req.user.id, name: name || 'Untitled', style: style || 'Modern', roomType: roomType || 'Living Room', shareToken: crypto_1.default.randomBytes(16).toString('hex') });
        res.status(201).json(project);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        await index_1.Project.deleteOne({ _id: req.params.id, userId: req.user.id });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
