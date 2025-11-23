import { Hono } from "hono";
import { getPlugin } from "@/server/core/actions/registry";
import { payX402 } from "@/server/core/x402/client";
import {
  getAvailableActions,
  getRedemption,
  getRedemptionByInstanceId,
  updateRedemptionStatus,
  updateSponsorBalance,
} from "@/server/db/queries";

export const actionsRouter = new Hono();

// POST /actions/start
actionsRouter.post("/start", async (c) => {
  const body = await c.req.json<{
    actionId: string;
    userId?: string;
    resourceId?: string;
  }>();

  const { actionId, resourceId = "paywall" } = body;
  const userId = body.userId ?? "anon";

  try {
    // Get the action from database
    const { db } = await import("@/server/db/client");
    const { actions } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");

    const action = await db.query.actions.findFirst({
      where: eq(actions.id, actionId),
      with: {
        sponsor: true,
      },
    });

    if (!action || !action.active) {
      return c.json({ error: "Action not found or inactive" }, 404);
    }

    if (!action.sponsor) {
      return c.json({ error: "Action has no sponsor" }, 400);
    }

    // Get plugin and start action
    const plugin = getPlugin(action.pluginId);
    if (!plugin) {
      return c.json({ error: "Unknown plugin" }, 500);
    }

    const startResult = await plugin.start({
      userId,
      resourceId,
      actionId: action.id,
      config: action.config as Record<string, unknown>,
    });

    // Create redemption instance
    const { createRedemption } = await import("@/server/db/queries");
    const instanceId = startResult.instanceId;

    await createRedemption({
      actionId: action.id,
      userId,
      resourceId,
      instanceId,
      sponsored_amount: action.max_redemption_price,
      metadata: {
        source: "paywall-widget",
        instructions: startResult.instructions,
        url: startResult.url,
      },
    });

    return c.json({
      instanceId,
      instructions: startResult.instructions,
      url: startResult.url,
      metadata: startResult.metadata,
    });
  } catch (error) {
    console.error("Error starting action:", error);
    return c.json(
      {
        error: "Failed to start action",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// GET /actions/available
actionsRouter.get("/available", async (c) => {
  const userId = c.req.query("userId") || c.req.header("x-user-id");
  console.log("GET /actions/available - userId:", userId);

  try {
    const availableActions = await getAvailableActions(userId);
    console.log("Found available actions:", availableActions.length);

    // Serialize actions for JSON response
    const serializedActions = availableActions.map((action) => {
      return {
        id: action.id,
        pluginId: action.pluginId,
        config: action.config,
        coverageType: action.coverageType,
        coveragePercent: action.coveragePercent?.toString(),
        recurrence: action.recurrence,
        maxRedemptionPrice: action.max_redemption_price.toString(),
        active: action.active,
        createdAt: action.createdAt.toISOString(),
        sponsor: action.sponsor
          ? {
              id: action.sponsor.id,
              walletAddress: action.sponsor.walletAddress,
              balance: action.sponsor.balance.toString(),
            }
          : null,
      };
    });

    console.log("Returning serialized actions:", serializedActions.length);
    if (serializedActions.length > 0) {
      console.log(
        "Sample action:",
        JSON.stringify(serializedActions[0], null, 2),
      );
    } else {
      console.log("WARNING: No actions to return!");
    }
    return c.json({ actions: serializedActions });
  } catch (error) {
    console.error("Error in /actions/available:", error);
    return c.json(
      {
        error: "Failed to fetch actions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// POST /actions/validate
actionsRouter.post("/validate", async (c) => {
  const body = await c.req.json<{
    actionInstanceId: string;
    input: any;
    userId?: string;
  }>();

  const { actionInstanceId, input } = body;
  const userId = body.userId ?? "anon";

  const redemption = await getRedemptionByInstanceId(actionInstanceId);

  if (!redemption || redemption.status !== "pending") {
    return c.json({ error: "Invalid or non-pending action instance" }, 400);
  }

  const action = redemption.action;
  const plugin = getPlugin(action.pluginId);
  if (!plugin) return c.json({ error: "Unknown plugin" }, 500);

  const result = await plugin.validate({
    instanceId: actionInstanceId,
    userId,
    resourceId: redemption.resourceId,
    actionId: action.id,
    config: action.config as Record<string, any>,
    input,
  });

  if (result.status !== "completed" || !result.rewardEligible) {
    await updateRedemptionStatus(actionInstanceId, "failed");

    return c.json(
      { status: "failed", reason: result.reason ?? "Validation failed" },
      400,
    );
  }

  // Here you'd:
  // 1. Deduct sponsor balance
  // 2. Pay x402 upstream
  // 3. Mark redemption as completed
  // 4. Replay or resume the original API call (depending on your design)

  const sponsor = action.sponsor;
  if (!sponsor) {
    return c.json({ error: "Sponsor not found" }, 500);
  }

  // Calculate coverage amount (simplified - should use actual challenge amount)
  // For now, we'll need to store the challenge amount in the redemption
  // This is a simplified version
  const challengeAmount = 1000000n; // TODO: Get from stored challenge

  try {
    // Deduct sponsor balance
    await updateSponsorBalance(sponsor.id, -challengeAmount);

    // Pay x402 upstream
    const paymentResult = await payX402({
      amount: challengeAmount,
      currency: "USDC:base",
      network: "base",
    });

    if (!paymentResult.success) {
      // Refund sponsor if payment failed
      await updateSponsorBalance(sponsor.id, challengeAmount);
      return c.json(
        { error: "Payment failed", reason: paymentResult.error },
        500,
      );
    }

    // Mark redemption as completed
    await updateRedemptionStatus(actionInstanceId, "completed");

    return c.json({
      status: "completed",
      transactionHash: paymentResult.transactionHash,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to process redemption",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
