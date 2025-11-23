"use client";

import { useCallback, useMemo, useState } from "react";
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
}: PaywallClientProps) {
  const [actions, setActions] = useState<Action[]>(initialActions);

  const handleActionsChange = useCallback((updatedActions: Action[]) => {
    setActions(updatedActions);
  }, []);

  // Memoize props to prevent unnecessary re-renders
  const widgetProps = useMemo(
    () => ({
      resource: initialResource,
      actions,
      onActionsChange: handleActionsChange,
    }),
    [initialResource, actions, handleActionsChange],
  );

  return <PaywallWidget {...widgetProps} />;
}
