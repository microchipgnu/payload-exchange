export type CoverageType = "full" | "percent";

export type Recurrence = "one_time_per_user" | "per_request";

export interface ActionConfigMeta {
  coverageType: CoverageType;
  coveragePercent?: number; // 0–100 when coverageType === 'percent'
  recurrence: Recurrence;
}

// Import X402Challenge from x402 types
import type { X402Challenge } from "@/server/core/x402/types";

export interface CoverageResult {
  sponsorContribution: bigint;
  userContribution: bigint;
}

export function computeCoverage(
  challenge: X402Challenge,
  actionMeta: ActionConfigMeta,
): CoverageResult {
  const price = challenge.amount;

  if (actionMeta.coverageType === "full") {
    return { sponsorContribution: price, userContribution: 0n };
  }

  if (actionMeta.coverageType === "percent") {
    const percent = BigInt(actionMeta.coveragePercent ?? 0);
    const sponsorContribution = (price * percent) / 100n;
    const userContribution = price - sponsorContribution;
    return { sponsorContribution, userContribution };
  }

  return { sponsorContribution: 0n, userContribution: price };
}

export function canRedeemActionForUser(params: {
  recurrence: Recurrence;
  pastRedemptionsCount: number;
}): boolean {
  const { recurrence, pastRedemptionsCount } = params;

  if (recurrence === "per_request") return true;
  if (recurrence === "one_time_per_user") return pastRedemptionsCount === 0;
  return true;
}
