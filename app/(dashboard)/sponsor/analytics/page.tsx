"use client";

import { useEvmAddress, useIsSignedIn, useSignOut } from "@coinbase/cdp-hooks";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletAuth } from "@/components/wallet-auth";

interface Analytics {
  balance: string;
  totalSpent: string;
  totalRedemptions: number;
  actionsCount: number;
}

export default function SponsorAnalyticsPage() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!evmAddress) return;
    try {
      const res = await fetch("/api/payload/sponsors/analytics", {
        headers: {
          "x-wallet-address": evmAddress,
        },
      });
      const data = await res.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    }
  }, [evmAddress]);

  useEffect(() => {
    if (evmAddress) {
      loadAnalytics();
    }
  }, [loadAnalytics, evmAddress]);

  if (!isSignedIn || !evmAddress) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Analytics</h1>
        <Card>
          <CardContent className="pt-6">
            <WalletAuth />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  const balanceUSD = (BigInt(analytics.balance) / BigInt(1_000_000)).toString();
  const totalSpentUSD = (
    BigInt(analytics.totalSpent) / BigInt(1_000_000)
  ).toString();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <div className="mt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Wallet Address:
            </p>
            <p className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
              {evmAddress}
            </p>
          </div>
        </div>
        <Button onClick={signOut} variant="outline">
          Sign Out
        </Button>
      </div>

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
