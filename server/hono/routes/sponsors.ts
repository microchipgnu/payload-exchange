import { Hono } from "hono";
import { TREASURY_WALLET_ADDRESS } from "@/lib/config";
import { getPlugin, listPlugins } from "@/server/core/actions/registry";
import {
  createAction,
  createFundingTransaction,
  createSponsor,
  getSponsorActions,
  getSponsorByWallet,
  updateActionStatus,
  updateFundingTransactionStatus,
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
  // Convert BigInt values to strings for JSON serialization
  const serializedActions = actions.map((action) => ({
    ...action,
    max_redemption_price: action.max_redemption_price.toString(),
    coveragePercent: action.coveragePercent?.toString(),
    createdAt: action.createdAt.toISOString(),
    redemptions: action.redemptions?.map((redemption) => ({
      ...redemption,
      sponsored_amount: redemption.sponsored_amount.toString(),
      createdAt: redemption.createdAt.toISOString(),
      completedAt: redemption.completedAt?.toISOString(),
    })),
  }));
  return c.json({ actions: serializedActions });
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
    max_redemption_price: string; // bigint as string
  }>();

  let sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    await createSponsor(walletAddress);
    sponsor = await getSponsorByWallet(walletAddress);
  }

  if (!sponsor) {
    return c.json({ error: "Failed to create sponsor" }, 500);
  }

  // Check balance before creating action
  if (sponsor.balance <= 0n) {
    return c.json(
      { error: "Insufficient balance. Please fund your account first." },
      400,
    );
  }

  const actionId = await createAction({
    sponsorId: sponsor.id,
    pluginId: body.pluginId,
    config: body.config,
    coverageType: body.coverageType,
    coveragePercent: body.coveragePercent,
    recurrence: body.recurrence,
    max_redemption_price: BigInt(body.max_redemption_price),
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
    transactionHash?: string; // Optional: if transaction already sent from client
  }>();

  let sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    await createSponsor(walletAddress);
    sponsor = await getSponsorByWallet(walletAddress);
  }

  if (!sponsor) {
    return c.json({ error: "Failed to create sponsor" }, 500);
  }

  const amount = BigInt(body.amount);
  const treasuryWallet = TREASURY_WALLET_ADDRESS;

  // Create funding transaction record
  const fundingTransactionId = await createFundingTransaction({
    sponsorId: sponsor.id,
    amount,
    treasuryWallet,
    transactionHash: body.transactionHash,
  });

  // If transaction hash is provided (client-side transaction), mark as completed
  if (body.transactionHash) {
    await updateFundingTransactionStatus(
      fundingTransactionId,
      "completed",
      body.transactionHash,
    );
    // Credit sponsor balance
    await updateSponsorBalance(sponsor.id, amount);

    const updatedSponsor = await getSponsorByWallet(walletAddress);
    return c.json({
      success: true,
      transactionHash: body.transactionHash,
      fundingTransactionId,
      newBalance: updatedSponsor?.balance.toString() || "0",
    });
  }

  // Otherwise, return the funding transaction ID for client to send transaction
  // The client will send the transaction and then call this endpoint again with transactionHash
  return c.json({
    success: true,
    fundingTransactionId,
    treasuryWallet,
    amount: amount.toString(),
    message: "Please send transaction to treasury wallet",
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

// PATCH /sponsors/actions/:id/status
sponsorsRouter.patch("/actions/:id/status", async (c) => {
  const walletAddress = c.req.header("x-wallet-address");
  if (!walletAddress) {
    return c.json({ error: "Wallet address required" }, 401);
  }

  const actionId = c.req.param("id");
  const body = await c.req.json<{ active: boolean }>();

  const sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    return c.json({ error: "Sponsor not found" }, 404);
  }

  // Verify the action belongs to this sponsor
  const actions = await getSponsorActions(sponsor.id);
  const action = actions.find((a) => a.id === actionId);
  if (!action) {
    return c.json({ error: "Action not found" }, 404);
  }

  await updateActionStatus(actionId, body.active);

  return c.json({ success: true, active: body.active });
});
