import { Hono } from "hono";
import { TREASURY_WALLET_ADDRESS } from "@/lib/config";
import { getPlugin, listPlugins } from "@/server/core/actions/registry";
import { verifyUSDCTransfer } from "@/server/core/blockchain/verify-transaction";
import {
  createAction,
  createFundingTransaction,
  createSponsor,
  getFailedResponseProofs,
  getResponseProof,
  getResponseProofsBySponsor,
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
  const serializedActions = actions.map((action) => {
    const { max_redemption_price, ...rest } = action;
    return {
      ...rest,
      maxRedemptionPrice: max_redemption_price.toString(),
      coveragePercent: action.coveragePercent?.toString(),
      createdAt: action.createdAt.toISOString(),
      redemptions: action.redemptions?.map((redemption) => ({
        ...redemption,
        sponsored_amount: redemption.sponsored_amount.toString(),
        createdAt: redemption.createdAt.toISOString(),
        completedAt: redemption.completedAt?.toISOString(),
        metadata: redemption.metadata || undefined,
      })),
    };
  });
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
    maxRedemptionPrice?: string;
    max_redemption_price?: string; // bigint as string (legacy support)
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

  // Support both camelCase and snake_case for backward compatibility
  const maxRedemptionPrice =
    body.maxRedemptionPrice || body.max_redemption_price;
  if (!maxRedemptionPrice) {
    return c.json({ error: "maxRedemptionPrice is required" }, 400);
  }

  const actionId = await createAction({
    sponsorId: sponsor.id,
    pluginId: body.pluginId,
    config: body.config,
    coverageType: body.coverageType,
    coveragePercent: body.coveragePercent,
    recurrence: body.recurrence,
    max_redemption_price: BigInt(maxRedemptionPrice),
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

  // If transaction hash is provided (client-side transaction), verify it on-chain
  if (body.transactionHash) {
    // Verify the transaction on-chain before crediting balance
    const verification = await verifyUSDCTransfer(
      body.transactionHash,
      walletAddress as `0x${string}`,
      treasuryWallet as `0x${string}`,
      amount,
    );

    if (!verification.success || !verification.verified) {
      // Mark transaction as failed
      await updateFundingTransactionStatus(
        fundingTransactionId,
        "failed",
        body.transactionHash,
      );
      return c.json(
        {
          error: "Transaction verification failed",
          details: verification.error || "Transaction could not be verified",
        },
        400,
      );
    }

    // Transaction verified successfully - update status and credit balance
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
      verified: true,
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

// GET /sponsors/proofs
sponsorsRouter.get("/proofs", async (c) => {
  const walletAddress = c.req.header("x-wallet-address");
  if (!walletAddress) {
    return c.json({ error: "Wallet address required" }, 401);
  }

  const sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    return c.json({ error: "Sponsor not found" }, 404);
  }

  const limit = Number.parseInt(c.req.query("limit") || "100", 10);
  const proofs = await getResponseProofsBySponsor(sponsor.id, limit);

  // Serialize proofs for JSON response
  const serializedProofs = proofs.map((proof) => ({
    id: proof.id,
    resourceId: proof.resourceId,
    url: proof.url,
    method: proof.method,
    statusCode: proof.statusCode,
    statusText: proof.statusText,
    proof: proof.proof,
    userId: proof.userId,
    actionId: proof.actionId,
    metadata: proof.metadata || undefined,
    createdAt: proof.createdAt.toISOString(),
    action: proof.action
      ? {
          id: proof.action.id,
          pluginId: proof.action.pluginId,
          coverageType: proof.action.coverageType,
        }
      : undefined,
  }));

  return c.json({ proofs: serializedProofs });
});

// GET /sponsors/proofs/failed
sponsorsRouter.get("/proofs/failed", async (c) => {
  const walletAddress = c.req.header("x-wallet-address");
  if (!walletAddress) {
    return c.json({ error: "Wallet address required" }, 401);
  }

  const sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    return c.json({ error: "Sponsor not found" }, 404);
  }

  const limit = Number.parseInt(c.req.query("limit") || "100", 10);
  const failedProofs = await getFailedResponseProofs(sponsor.id, limit);

  // Serialize proofs for JSON response
  const serializedProofs = failedProofs.map((proof) => ({
    id: proof.id,
    resourceId: proof.resourceId,
    url: proof.url,
    method: proof.method,
    statusCode: proof.statusCode,
    statusText: proof.statusText,
    proof: proof.proof,
    userId: proof.userId,
    actionId: proof.actionId,
    metadata: proof.metadata || undefined,
    createdAt: proof.createdAt.toISOString(),
    action: proof.action
      ? {
          id: proof.action.id,
          pluginId: proof.action.pluginId,
          coverageType: proof.action.coverageType,
        }
      : undefined,
  }));

  return c.json({ proofs: serializedProofs });
});

// GET /sponsors/proofs/:id
sponsorsRouter.get("/proofs/:id", async (c) => {
  const walletAddress = c.req.header("x-wallet-address");
  if (!walletAddress) {
    return c.json({ error: "Wallet address required" }, 401);
  }

  const sponsor = await getSponsorByWallet(walletAddress);
  if (!sponsor) {
    return c.json({ error: "Sponsor not found" }, 404);
  }

  const proofId = c.req.param("id");
  const proof = await getResponseProof(proofId);

  if (!proof) {
    return c.json({ error: "Proof not found" }, 404);
  }

  // Verify the proof belongs to this sponsor
  if (proof.sponsorId !== sponsor.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  return c.json({
    id: proof.id,
    resourceId: proof.resourceId,
    url: proof.url,
    method: proof.method,
    statusCode: proof.statusCode,
    statusText: proof.statusText,
    proof: proof.proof,
    userId: proof.userId,
    actionId: proof.actionId,
    metadata: proof.metadata || undefined,
    createdAt: proof.createdAt.toISOString(),
    action: proof.action
      ? {
          id: proof.action.id,
          pluginId: proof.action.pluginId,
          coverageType: proof.action.coverageType,
        }
      : undefined,
  });
});
