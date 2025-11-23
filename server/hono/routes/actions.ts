import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getPlugin } from "@/server/core/actions/registry";
import { payX402 } from "@/server/core/x402/client";
import { db } from "@/server/db/client";
import {
  getAvailableActions,
  getRedemptionByInstanceId,
  updateRedemptionSponsoredAmount,
  updateRedemptionStatus,
  updateSponsorBalance,
} from "@/server/db/queries";
import { redemptions } from "@/server/db/schema";

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

  try {
    const availableActions = await getAvailableActions(userId);

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

  // Determine the actual amount to deduct
  // The proxy flow may have created a separate redemption with the actual amount
  // Check if there's a completed redemption for the same action/user/resource with actual amount
  let actualAmount = redemption.sponsored_amount;

  // Look for completed redemptions for the same action/user/resource
  // These would have been created by the proxy flow with the actual amount
  const completedRedemptions = await db.query.redemptions.findMany({
    where: and(
      eq(redemptions.actionId, action.id),
      eq(redemptions.userId, userId),
      eq(redemptions.resourceId, redemption.resourceId),
      eq(redemptions.status, "completed"),
    ),
    orderBy: (redemptions, { desc }) => [desc(redemptions.createdAt)],
    limit: 1,
  });

  // If proxy flow already processed this and deducted balance, don't deduct again
  if (completedRedemptions.length > 0) {
    const completedRedemption = completedRedemptions[0];
    actualAmount = completedRedemption.sponsored_amount;

    // Update the current redemption's sponsored_amount to match the actual amount
    if (redemption.sponsored_amount !== actualAmount) {
      await updateRedemptionSponsoredAmount(redemption.id, actualAmount);
    }

    // Mark this redemption as completed without deducting (already deducted by proxy flow)
    await updateRedemptionStatus(actionInstanceId, "completed");

    return c.json({
      status: "completed",
      message: "Redemption already processed by proxy flow",
      actualAmount: actualAmount.toString(),
    });
  }

  // Check if redemption metadata contains the actual amount (from proxy flow)
  const metadata = redemption.metadata as Record<string, unknown> | undefined;

  // If metadata contains coverage information with the actual sponsor contribution,
  // use that instead of the max_redemption_price
  if (metadata?.coverage && typeof metadata.coverage === "object") {
    const coverage = metadata.coverage as Record<string, unknown>;
    if (
      coverage.sponsorContribution &&
      typeof coverage.sponsorContribution === "string"
    ) {
      try {
        actualAmount = BigInt(coverage.sponsorContribution);
        // Update the redemption record with the actual amount
        await updateRedemptionSponsoredAmount(redemption.id, actualAmount);
      } catch {
        // If parsing fails, use the existing sponsored_amount
      }
    }
  }

  try {
    // Deduct sponsor balance using the actual amount sent
    await updateSponsorBalance(sponsor.id, -actualAmount);

    // Pay x402 upstream
    const paymentResult = await payX402({
      amount: actualAmount,
      currency: "USDC:base",
      network: "base",
    });

    if (!paymentResult.success) {
      // Refund sponsor if payment failed
      await updateSponsorBalance(sponsor.id, actualAmount);
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
