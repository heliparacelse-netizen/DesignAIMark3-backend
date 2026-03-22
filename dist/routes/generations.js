"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const index_1 = require("../models/index");
const router = (0, express_1.Router)();
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const generations = await index_1.Generation.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
        res.json(generations);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        await index_1.Generation.deleteOne({ _id: req.params.id, userId: req.user.id });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
