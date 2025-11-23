import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { actions, fundingTransactions, redemptions, sponsors } from "./schema";

export async function getActionForResourceAndUser(userId: string) {
  // Find any available action that:
  // 1. Is active
  // 2. Has a sponsor with sufficient balance
  // 3. User hasn't redeemed yet (if one_time_per_user)
  const action = await db.query.actions.findFirst({
    where: eq(actions.active, true),
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

export async function getAvailableActions(userId?: string) {
  // Get all active actions with sponsors
  const allActions = await db.query.actions.findMany({
    where: eq(actions.active, true),
    with: {
      sponsor: true,
    },
    orderBy: desc(actions.createdAt),
  });

  console.log(`getAvailableActions: Found ${allActions.length} active actions`);

  // Filter to only actions that are actually available:
  // 1. Must have a sponsor
  // 2. Sponsor must have sufficient balance (at least max_redemption_price)
  const availableActions = allActions.filter((action) => {
    // Must have a sponsor
    if (!action.sponsor) {
      console.log(`Action ${action.id} filtered out: no sponsor`);
      return false;
    }

    // Sponsor must have sufficient balance
    if (action.sponsor.balance < action.max_redemption_price) {
      console.log(
        `Action ${action.id} filtered out: insufficient sponsor balance (${action.sponsor.balance.toString()} < ${action.max_redemption_price.toString()})`,
      );
      return false;
    }

    return true;
  });

  console.log(
    `getAvailableActions: ${availableActions.length} actions after sponsor/balance filter`,
  );

  // If userId is provided, filter out actions user has already redeemed (for one_time_per_user)
  if (userId) {
    const filteredActions = [];
    for (const action of availableActions) {
      if (action.recurrence === "one_time_per_user") {
        const pastRedemptions = await db.query.redemptions.findMany({
          where: and(
            eq(redemptions.actionId, action.id),
            eq(redemptions.userId, userId),
            eq(redemptions.status, "completed"),
          ),
        });

        if (pastRedemptions.length === 0) {
          filteredActions.push(action);
        } else {
          console.log(
            `Action ${action.id} filtered out: user already redeemed`,
          );
        }
      } else {
        filteredActions.push(action);
      }
    }
    console.log(
      `getAvailableActions: ${filteredActions.length} actions after userId filter`,
    );
    return filteredActions;
  }

  return availableActions;
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
  metadata?: Record<string, unknown>;
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

export async function getRedemptionByInstanceId(instanceId: string) {
  return db.query.redemptions.findFirst({
    where: eq(redemptions.instanceId, instanceId),
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
  max_redemption_price: bigint;
}) {
  const id = crypto.randomUUID();
  await db.insert(actions).values({
    id,
    ...params,
    coveragePercent: params.coveragePercent ?? null,
    active: true,
  });
  return id;
}

export async function updateActionStatus(actionId: string, active: boolean) {
  await db.update(actions).set({ active }).where(eq(actions.id, actionId));
}

export async function createFundingTransaction(params: {
  sponsorId: string;
  amount: bigint;
  treasuryWallet: string;
  transactionHash?: string;
}) {
  const id = crypto.randomUUID();
  await db.insert(fundingTransactions).values({
    id,
    sponsorId: params.sponsorId,
    amount: params.amount,
    treasuryWallet: params.treasuryWallet,
    transactionHash: params.transactionHash ?? null,
    status: "pending",
  });
  return id;
}

export async function updateFundingTransactionStatus(
  fundingTransactionId: string,
  status: "pending" | "completed" | "failed",
  transactionHash?: string,
) {
  await db
    .update(fundingTransactions)
    .set({
      status,
      transactionHash: transactionHash ?? undefined,
      completedAt:
        status === "completed" || status === "failed" ? new Date() : undefined,
    })
    .where(eq(fundingTransactions.id, fundingTransactionId));
}

export async function getFundingTransaction(fundingTransactionId: string) {
  return db.query.fundingTransactions.findFirst({
    where: eq(fundingTransactions.id, fundingTransactionId),
    with: {
      sponsor: true,
    },
  });
}
