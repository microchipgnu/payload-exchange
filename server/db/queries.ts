import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { actions, redemptions, sponsors } from "./schema";

export async function getActionForResourceAndUser(userId: string) {
  // Find any available action that:
  // 1. Has a sponsor with sufficient balance
  // 2. User hasn't redeemed yet (if one_time_per_user)
  const action = await db.query.actions.findFirst({
    with: {
      sponsor: true,
      redemptions: {
        where: eq(redemptions.userId, userId),
        orderBy: desc(redemptions.createdAt),
        limit: 1,
      },
    },
    orderBy: desc(actions.createdAt),
  });

  if (!action) return null;
  if (!action.sponsor) return null;

  // Check if user has already redeemed (for one_time_per_user)
  if (action.recurrence === "one_time_per_user") {
    const pastRedemptions = await db.query.redemptions.findMany({
      where: and(
        eq(redemptions.actionId, action.id),
        eq(redemptions.userId, userId),
        eq(redemptions.status, "completed"),
      ),
    });

    if (pastRedemptions.length > 0) {
      return null; // User already redeemed
    }
  }

  return action;
}

export async function getSponsorActions(sponsorId: string) {
  return db.query.actions.findMany({
    where: eq(actions.sponsorId, sponsorId),
    orderBy: desc(actions.createdAt),
    with: {
      redemptions: {
        orderBy: desc(redemptions.createdAt),
      },
    },
  });
}

export async function getSponsorByWallet(walletAddress: string) {
  return db.query.sponsors.findFirst({
    where: eq(sponsors.walletAddress, walletAddress),
  });
}

export async function createSponsor(walletAddress: string) {
  const id = crypto.randomUUID();
  await db.insert(sponsors).values({
    id,
    walletAddress,
    balance: 0n,
  });
  return id;
}

export async function createRedemption(params: {
  actionId: string;
  userId: string;
  resourceId: string;
  instanceId: string;
  sponsored_amount: bigint;
}) {
  const id = crypto.randomUUID();
  await db.insert(redemptions).values({
    id,
    ...params,
    status: "pending",
  });
  return id;
}

export async function updateRedemptionStatus(
  redemptionId: string,
  status: "pending" | "completed" | "failed",
) {
  await db
    .update(redemptions)
    .set({
      status,
      completedAt: status === "completed" ? new Date() : undefined,
    })
    .where(eq(redemptions.id, redemptionId));
}

export async function getRedemption(redemptionId: string) {
  return db.query.redemptions.findFirst({
    where: eq(redemptions.id, redemptionId),
    with: {
      action: {
        with: {
          sponsor: true,
        },
      },
    },
  });
}

export async function updateSponsorBalance(sponsorId: string, delta: bigint) {
  const sponsor = await db.query.sponsors.findFirst({
    where: eq(sponsors.id, sponsorId),
  });

  if (!sponsor) {
    throw new Error(`Sponsor ${sponsorId} not found`);
  }

  const newBalance = sponsor.balance + delta;

  if (newBalance < 0n) {
    throw new Error("Insufficient balance");
  }

  await db
    .update(sponsors)
    .set({
      balance: newBalance,
      updatedAt: new Date(),
    })
    .where(eq(sponsors.id, sponsorId));

  return newBalance;
}

export async function createAction(params: {
  sponsorId: string;
  pluginId: string;
  config: Record<string, any>;
  coverageType: "full" | "percent";
  coveragePercent?: number;
  recurrence: "one_time_per_user" | "per_request";
  maxRedemptionPrice: string;
}) {
  const id = crypto.randomUUID();
  await db.insert(actions).values({
    id,
    ...params,
    coveragePercent: params.coveragePercent ?? null,
    max_redemption_price: BigInt(params.maxRedemptionPrice),
  });
  return id;
}
