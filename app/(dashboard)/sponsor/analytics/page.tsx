"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Analytics {
  balance: string;
  totalSpent: string;
  totalRedemptions: number;
  actionsCount: number;
}

export default function SponsorAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/payload/sponsors/analytics", {
        headers: {
          "x-wallet-address": "0x0000000000000000000000000000000000000000", // TODO: Get from wallet
        },
      });
      const data = await res.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (!analytics) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  const balanceUSD = (BigInt(analytics.balance) / BigInt(1_000_000)).toString();
  const totalSpentUSD = (
    BigInt(analytics.totalSpent) / BigInt(1_000_000)
  ).toString();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Analytics</h1>

      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">${balanceUSD}</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              USDC available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">${totalSpentUSD}</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Redemptions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{analytics.totalRedemptions}</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Completed actions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{analytics.actionsCount}</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Active campaigns
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
