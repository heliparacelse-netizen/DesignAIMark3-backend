import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: String,
  plan: { type: String, default: 'free' },
  tokens: { type: Number, default: 3 },
  stripeId: String,
}, { timestamps: true });

const ProjectSchema = new mongoose.Schema({
  userId: String,
  name: { type: String, default: 'Untitled' },
  roomType: { type: String, default: 'Living Room' },
  style: { type: String, default: 'Modern' },
  coverUrl: String,
  isPublic: { type: Boolean, default: false },
  shareToken: String,
}, { timestamps: true });

const GenerationSchema = new mongoose.Schema({
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

const PurchaseSchema = new mongoose.Schema({
  userId: String,
  tokens: Number,
  amount: Number,
  plan: String,
  stripeId: String,
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
export const Project = mongoose.model('Project', ProjectSchema);
export const Generation = mongoose.model('Generation', GenerationSchema);
export const Purchase = mongoose.model('Purchase', PurchaseSchema);
