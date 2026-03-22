"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const index_1 = require("../models/index");
const router = (0, express_1.Router)();
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const user = await index_1.User.findById(req.user.id).select('tokens plan').lean();
        res.json({ tokens: user?.tokens || 0, plan: user?.plan || 'free' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
