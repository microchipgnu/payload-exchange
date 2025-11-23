"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PaywallWidget } from "@/components/paywall-widget";
import type { Resource } from "@/server/core/resources/types";

interface Action {
  id: string;
  pluginId: string;
  config: Record<string, unknown>;
  coverageType: "full" | "percent";
  coveragePercent?: string;
  recurrence: "one_time_per_user" | "per_request";
  maxRedemptionPrice: string;
  active: boolean;
  createdAt: string;
  sponsor: {
    id: string;
    walletAddress: string;
    balance: string;
  } | null;
}

interface PaywallClientProps {
  initialResource: Resource | null;
  initialActions: Action[];
  userId?: string;
}

export function PaywallClient({
  initialResource,
  initialActions,
  userId,
}: PaywallClientProps) {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>(initialActions);

  const handleActionsChange = (updatedActions: Action[]) => {
    setActions(updatedActions);
    // Optionally refresh the page to get latest data from server
    router.refresh();
  };

  return (
    <PaywallWidget
      resource={initialResource}
      actions={actions}
      onActionsChange={handleActionsChange}
    />
  );
}

