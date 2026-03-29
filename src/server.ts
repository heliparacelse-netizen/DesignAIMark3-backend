import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import connectDB from './lib/db';
import authRoutes from './routes/auth';
import generateRoutes from './routes/generate';
import projectsRoutes from './routes/projects';
import generationsRoutes from './routes/generations';
import stripeRoutes from './routes/stripe';
import tokensRoutes from './routes/tokens';
import analyzeRoutes from './routes/analyze';
import chatRoutes from './routes/chat';

connectDB();

const app = express();
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));
app.use(cors({ origin: '*', credentials: false }));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'Roomvera API' }));
app.use('/api/auth', authRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/generations', generationsRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/tokens', tokensRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', analyzeRoutes);

const PORT = parseInt(process.env.PORT || '3001');
app.listen(PORT, '0.0.0.0', () => console.log(`Roomvera API on port ${PORT}`));
export default app;
