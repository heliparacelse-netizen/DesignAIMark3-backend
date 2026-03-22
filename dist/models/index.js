"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Purchase = exports.Generation = exports.Project = exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const UserSchema = new mongoose_1.default.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    plan: { type: String, default: 'free' },
    tokens: { type: Number, default: 3 },
    stripeId: String,
}, { timestamps: true });
const ProjectSchema = new mongoose_1.default.Schema({
    userId: String,
    name: { type: String, default: 'Untitled' },
    roomType: { type: String, default: 'Living Room' },
    style: { type: String, default: 'Modern' },
    coverUrl: String,
    isPublic: { type: Boolean, default: false },
    shareToken: String,
}, { timestamps: true });
const GenerationSchema = new mongoose_1.default.Schema({
    userId: String,
    projectId: String,
    prompt: String,
    style: String,
    roomType: String,
    inputUrl: String,
    imageUrl: String,
    shareToken: String,
    isPublic: { type: Boolean, default: false },
}, { timestamps: true });
const PurchaseSchema = new mongoose_1.default.Schema({
    userId: String,
    tokens: Number,
    amount: Number,
    plan: String,
    stripeId: String,
}, { timestamps: true });
exports.User = mongoose_1.default.model('User', UserSchema);
exports.Project = mongoose_1.default.model('Project', ProjectSchema);
exports.Generation = mongoose_1.default.model('Generation', GenerationSchema);
exports.Purchase = mongoose_1.default.model('Purchase', PurchaseSchema);
