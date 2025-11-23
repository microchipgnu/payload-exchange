import { useCallback, useEffect, useState } from "react";

interface Sponsor {
  id: string;
  walletAddress: string;
  balance: string;
}

interface Action {
  id: string;
  pluginId: string;
  resourceId: string;
  coverageType: "full" | "percent";
  coveragePercent?: number;
  recurrence: "one_time_per_user" | "per_request";
  config: Record<string, any>;
}

interface Analytics {
  balance: string;
  totalSpent: string;
  totalRedemptions: number;
  actionsCount: number;
}

export function useSponsor(walletAddress: string | null) {
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSponsor = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payload/sponsors/analytics", {
        headers: {
          "x-wallet-address": walletAddress,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSponsor({
          id: "", // Will be populated from actions endpoint if needed
          walletAddress,
          balance: data.balance || "0",
        });
      }
    } catch (error) {
      console.error("Failed to load sponsor:", error);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    loadSponsor();
  }, [walletAddress, loadSponsor]);

  return { sponsor, loading, refetch: loadSponsor };
}

export function useSponsorActions(walletAddress: string | null) {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);

  const loadActions = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payload/sponsors/actions", {
        headers: {
          "x-wallet-address": walletAddress,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
      }
    } catch (error) {
      console.error("Failed to load actions:", error);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    loadActions();
  }, [walletAddress, loadActions]);

  return { actions, loading, refetch: loadActions };
}

export function useSponsorAnalytics(walletAddress: string | null) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payload/sponsors/analytics", {
        headers: {
          "x-wallet-address": walletAddress,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    loadAnalytics();
  }, [walletAddress, loadAnalytics]);

  return { analytics, loading, refetch: loadAnalytics };
}
