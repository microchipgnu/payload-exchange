import { Hono } from "hono";
import { getPlugin, listPlugins } from "@/server/core/actions/registry";
import { payX402 } from "@/server/core/x402/client";
import {
  createAction,
  createSponsor,
  getSponsorActions,
  getSponsorByWallet,
  updateSponsorBalance,
} from "@/server/db/queries";

export const sponsorsRouter = new Hono();

// GET /sponsors/actions
sponsorsRouter.get("/actions", async (c) => {
  const walletAddress = c.req.header("x-wallet-address");
  if (!walletAddress) {
    return c.json({ error: "Wallet address required" }, 401);
  }

  let sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    // Create sponsor if doesn't exist
    await createSponsor(walletAddress);
    sponsor = await getSponsorByWallet(walletAddress);
  }

  if (!sponsor) {
    return c.json({ error: "Failed to create sponsor" }, 500);
  }

  const actions = await getSponsorActions(sponsor.id);
  return c.json({ actions });
});

// POST /sponsors/actions
sponsorsRouter.post("/actions", async (c) => {
  const walletAddress = c.req.header("x-wallet-address");
  if (!walletAddress) {
    return c.json({ error: "Wallet address required" }, 401);
  }

  const body = await c.req.json<{
    pluginId: string;
    config: Record<string, unknown>;
    coverageType: "full" | "percent";
    coveragePercent?: number;
    recurrence: "one_time_per_user" | "per_request";
    resourceId: string;
  }>();

  let sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    await createSponsor(walletAddress);
    sponsor = await getSponsorByWallet(walletAddress);
  }

  if (!sponsor) {
    return c.json({ error: "Failed to create sponsor" }, 500);
  }

  const actionId = await createAction({
    sponsorId: sponsor.id,
    ...body,
  });

  return c.json({ id: actionId, success: true });
});

// POST /sponsors/fund
sponsorsRouter.post("/fund", async (c) => {
  const walletAddress = c.req.header("x-wallet-address");
  if (!walletAddress) {
    return c.json({ error: "Wallet address required" }, 401);
  }

  const body = await c.req.json<{
    amount: string; // bigint as string
    currency?: string;
    network?: string;
  }>();

  let sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    await createSponsor(walletAddress);
    sponsor = await getSponsorByWallet(walletAddress);
  }

  if (!sponsor) {
    return c.json({ error: "Failed to create sponsor" }, 500);
  }

  // In a real implementation, this would:
  // 1. Create x402 payment request
  // 2. User pays via wallet
  // 3. Verify payment
  // 4. Credit sponsor balance

  const amount = BigInt(body.amount);
  const paymentResult = await payX402({
    amount,
    currency: body.currency || "USDC:base",
    network: body.network || "base",
  });

  if (!paymentResult.success) {
    return c.json(
      { error: "Payment failed", reason: paymentResult.error },
      400,
    );
  }

  // Credit sponsor balance
  await updateSponsorBalance(sponsor.id, amount);

  return c.json({
    success: true,
    transactionHash: paymentResult.transactionHash,
    newBalance: (sponsor.balance + amount).toString(),
  });
});

// POST /sponsors/withdraw
sponsorsRouter.post("/withdraw", async (c) => {
  const walletAddress = c.req.header("x-wallet-address");
  if (!walletAddress) {
    return c.json({ error: "Wallet address required" }, 401);
  }

  const body = await c.req.json<{
    amount: string; // bigint as string
  }>();

  const sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    return c.json({ error: "Sponsor not found" }, 404);
  }

  const amount = BigInt(body.amount);

  if (sponsor.balance < amount) {
    return c.json({ error: "Insufficient balance" }, 400);
  }

  // Deduct balance
  await updateSponsorBalance(sponsor.id, -amount);

  // In a real implementation, transfer funds to wallet
  // For now, just return success

  return c.json({
    success: true,
    newBalance: (sponsor.balance - amount).toString(),
  });
});

// GET /sponsors/analytics
sponsorsRouter.get("/analytics", async (c) => {
  const walletAddress = c.req.header("x-wallet-address");
  if (!walletAddress) {
    return c.json({ error: "Wallet address required" }, 401);
  }

  const sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    return c.json({ error: "Sponsor not found" }, 404);
  }

  const actions = await getSponsorActions(sponsor.id);

  // Calculate analytics
  const totalSpent = actions.reduce((sum, action) => {
    const completedRedemptions = action.redemptions.filter(
      (r) => r.status === "completed",
    ).length;
    // Simplified: assume 1 USDC per redemption
    return sum + BigInt(completedRedemptions) * BigInt(1000000);
  }, 0n);

  const totalRedemptions = actions.reduce(
    (sum, action) =>
      sum + action.redemptions.filter((r) => r.status === "completed").length,
    0,
  );

  return c.json({
    balance: sponsor.balance.toString(),
    totalSpent: totalSpent.toString(),
    totalRedemptions,
    actionsCount: actions.length,
  });
});

// GET /sponsors/plugins
sponsorsRouter.get("/plugins", async (c) => {
  const plugins = listPlugins();
  return c.json({
    plugins: plugins.map((p) => {
      const description = p.describe();
      return {
        id: p.id,
        name: p.name,
        description: description.humanInstructions,
        schema: description.schema,
      };
    }),
  });
});

// GET /sponsors/plugins/:id
sponsorsRouter.get("/plugins/:id", async (c) => {
  const pluginId = c.req.param("id");
  const plugin = getPlugin(pluginId);

  if (!plugin) {
    return c.json({ error: "Plugin not found" }, 404);
  }

  const description = plugin.describe();
  return c.json({
    id: plugin.id,
    name: plugin.name,
    description: description.humanInstructions,
    schema: description.schema,
  });
});
