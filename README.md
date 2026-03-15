import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import prisma from "../lib/prisma";

const router = Router();

const TOKEN_PACKS = {
  tokens_50: { tokens: 50, amount: 5.00, label: "50 tokens" },
  tokens_200: { tokens: 200, amount: 15.00, label: "200 tokens" },
  tokens_500: { tokens: 500, amount: 29.00, label: "500 tokens" },
};

// GET /api/tokens
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { tokens: true, plan: true },
    });

    const planLimits: Record<string, number> = {
      free: 3, starter: 120, pro: 350, studio: 1000,
    };

    res.json({
      tokens: user?.tokens || 0,
      plan: user?.plan || "free",
      planLimit: planLimits[user?.plan || "free"],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tokens/history
router.get("/history", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const purchases = await prisma.purchase.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json(purchases);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/tokens/buy — Create Stripe checkout for token pack
router.post("/buy", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { pack } = req.body; // "tokens_50" | "tokens_200" | "tokens_500"
    const selectedPack = TOKEN_PACKS[pack as keyof typeof TOKEN_PACKS];

    if (!selectedPack) {
      return res.status(400).json({ error: "Invalid token pack" });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

    const priceId = process.env[`STRIPE_PRICE_${pack.toUpperCase()}`];
    if (!priceId) {
      return res.status(400).json({ error: `Stripe price not configured for ${pack}` });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: req.user!.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?tokens_purchased=true`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/billing`,
      metadata: {
        userId: req.user!.id,
        type: "token_pack",
        pack,
        tokens: selectedPack.tokens.toString(),
        amount: selectedPack.amount.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
