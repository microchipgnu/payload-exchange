import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import {
  actions,
  fundingTransactions,
  redemptions,
  responseProofs,
  sponsors,
} from "./schema";

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

  // Filter to only actions that are actually available:
  // 1. Must have a sponsor
  // 2. Sponsor must have sufficient balance (at least max_redemption_price)
  const availableActions = allActions.filter((action) => {
    // Must have a sponsor
    if (!action.sponsor) {
      return false;
    }

    // Sponsor must have sufficient balance
    if (action.sponsor.balance < action.max_redemption_price) {
      return false;
    }

    return true;
  });

  // If userId is provided, batch load redemptions to avoid N+1 queries
  if (userId && availableActions.length > 0) {
    // Get all one-time-per-user action IDs
    const oneTimeActionIds = availableActions
      .filter((action) => action.recurrence === "one_time_per_user")
      .map((action) => action.id);

    // Batch load all redemptions for this user and these actions in a single query
    let userRedemptions: Array<{ actionId: string }> = [];
    if (oneTimeActionIds.length > 0) {
      const allUserRedemptions = await db.query.redemptions.findMany({
        where: and(
          eq(redemptions.userId, userId),
          eq(redemptions.status, "completed"),
        ),
        columns: { actionId: true },
      });
      userRedemptions = allUserRedemptions.filter((r: { actionId: string }) =>
        oneTimeActionIds.includes(r.actionId),
      );
    }

    // Create a Set for O(1) lookup
    const redeemedActionIds = new Set(userRedemptions.map((r) => r.actionId));

    // Filter out actions user has already redeemed
    return availableActions.filter((action) => {
      if (
        action.recurrence === "one_time_per_user" &&
        redeemedActionIds.has(action.id)
      ) {
        return false;
      }
      return true;
    });
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

export async function updateRedemptionSponsoredAmount(
  redemptionId: string,
  sponsored_amount: bigint,
) {
  await db
    .update(redemptions)
    .set({
      sponsored_amount,
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
  config: Record<string, unknown>;
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

export async function createResponseProof(params: {
  resourceId: string;
  url: string;
  method: string;
  statusCode: number;
  statusText?: string;
  proof: string;
  userId?: string;
  sponsorId?: string;
  actionId?: string;
  metadata?: Record<string, unknown>;
}) {
  const id = crypto.randomUUID();
  await db.insert(responseProofs).values({
    id,
    ...params,
  });
  return id;
}

export async function getResponseProofsBySponsor(
  sponsorId: string,
  limit = 100,
) {
  return db.query.responseProofs.findMany({
    where: eq(responseProofs.sponsorId, sponsorId),
    orderBy: desc(responseProofs.createdAt),
    limit,
    with: {
      action: true,
    },
  });
}

export async function getResponseProofsByResource(
  resourceId: string,
  limit = 100,
) {
  return db.query.responseProofs.findMany({
    where: eq(responseProofs.resourceId, resourceId),
    orderBy: desc(responseProofs.createdAt),
    limit,
    with: {
      sponsor: true,
      action: true,
    },
  });
}

export async function getResponseProof(proofId: string) {
  return db.query.responseProofs.findFirst({
    where: eq(responseProofs.id, proofId),
    with: {
      sponsor: true,
      action: true,
    },
  });
}

export async function getFailedResponseProofs(sponsorId?: string, limit = 100) {
  const conditions = [eq(responseProofs.statusCode, 500)];
  if (sponsorId) {
    conditions.push(eq(responseProofs.sponsorId, sponsorId));
  }
  return db.query.responseProofs.findMany({
    where: and(...conditions),
    orderBy: desc(responseProofs.createdAt),
    limit,
    with: {
      sponsor: true,
      action: true,
    },
  });
}
