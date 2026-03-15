import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import authRoutes from "./routes/auth";
import generateRoutes from "./routes/generate";
import projectsRoutes from "./routes/projects";
import generationsRoutes from "./routes/generations";
import stripeRoutes from "./routes/stripe";
import tokensRoutes from "./routes/tokens";
import analyzeRoutes from "./routes/analyze";

const app = express();

// Stripe webhook needs raw body — must come before express.json()
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Health check
app.get("/", (req, res) => res.json({ status: "ok", service: "Lumara API", version: "1.0.0" }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/generations", generationsRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/tokens", tokensRoutes);

// Analyze routes (room analysis, prompt improver, chat)
app.use("/api", analyzeRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Lumara API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
