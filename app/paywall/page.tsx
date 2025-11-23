import { getResource } from "@/server/core/resources/registry";
import { getAvailableActions } from "@/server/db/queries";
import { PaywallClient } from "./paywall-client";

export default async function PaywallPage({
  searchParams,
}: {
  searchParams: Promise<{ resourceUrl?: string; userId?: string }>;
}) {
  const { resourceUrl, userId } = await searchParams;

  // Fetch the resource if resourceUrl is provided
  let resource = null;
  if (resourceUrl) {
    resource = await getResource(resourceUrl);
  }

  // Fetch available actions from database
  const availableActions = await getAvailableActions(userId);

  // Serialize actions for client component (convert BigInt to string, dates to ISO)
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

  return (
    <div className="min-h-screen bg-transparent p-4">
      <PaywallClient
        initialResource={resource}
        initialActions={serializedActions}
        userId={userId}
      />
    </div>
  );
}
