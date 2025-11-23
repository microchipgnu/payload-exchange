"use client";

import { useEvmAddress, useIsSignedIn, useSignOut } from "@coinbase/cdp-hooks";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Label, Pie, PieChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WalletAuth } from "@/components/wallet-auth";

interface Analytics {
  balance: string;
  totalSpent: string;
  totalRedemptions: number;
  actionsCount: number;
}

interface Action {
  id: string;
  pluginId: string;
  coverageType: "full" | "percent";
  coveragePercent?: number;
  recurrence: "one_time_per_user" | "per_request";
  redemptions: Array<{
    status: string;
    sponsored_amount: string;
  }>;
}

export default function SponsorDashboard() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentActions, setRecentActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!evmAddress) return;
    setIsLoading(true);
    try {
      // Load analytics
      const analyticsRes = await fetch("/api/payload/sponsors/analytics", {
        headers: {
          "x-wallet-address": evmAddress,
        },
      });
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData);

      // Load recent actions
      const actionsRes = await fetch("/api/payload/sponsors/actions", {
        headers: {
          "x-wallet-address": evmAddress,
        },
      });
      const actionsData = await actionsRes.json();
      setRecentActions(actionsData.actions?.slice(0, 5) || []);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [evmAddress]);

  useEffect(() => {
    if (evmAddress) {
      loadData();
    }
  }, [loadData, evmAddress]);

  if (!isSignedIn || !evmAddress) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Sponsor Dashboard</h1>
        <Card>
          <CardContent className="pt-6">
            <WalletAuth />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  const balanceUSD = (BigInt(analytics.balance) / BigInt(1_000_000)).toString();
  const totalSpentUSD = (
    BigInt(analytics.totalSpent) / BigInt(1_000_000)
  ).toString();

  const getPluginName = (pluginId: string) => {
    const names: Record<string, string> = {
      survey: "Survey",
      "email-capture": "Email Capture",
      "github-star": "GitHub Star",
      "code-verification": "Code Verification",
    };
    return names[pluginId] || pluginId;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="mt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Wallet Address:
            </p>
            <p className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
              {evmAddress}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={signOut} variant="outline">
            Sign Out
          </Button>
          <Link href="/sponsor/billing">
            <Button variant="outline">Add Funds</Button>
          </Link>
          <Link href="/sponsor/actions">
            <Button>Create Campaign</Button>
          </Link>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${balanceUSD}</div>
            <p className="text-xs text-muted-foreground">USDC available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.actionsCount}</div>
            <p className="text-xs text-muted-foreground">Running now</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Redemptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.totalRedemptions}
            </div>
            <p className="text-xs text-muted-foreground">Users sponsored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpentUSD}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Overview with Donut Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Financial Overview</CardTitle>
          <p className="text-sm text-muted-foreground">
            Balance allocation and spending
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Donut Chart */}
            <div className="flex flex-col items-center justify-center">
              <ChartContainer
                config={{
                  spent: {
                    label: "Spent",
                    color: "hsl(var(--muted-foreground))",
                  },
                  available: {
                    label: "Available",
                    color: "hsl(var(--muted))",
                  },
                }}
                className="h-[250px] w-full"
              >
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Spent",
                        value: Number(totalSpentUSD),
                        fill: "hsl(var(--muted-foreground))",
                      },
                      {
                        name: "Available",
                        value: Number(balanceUSD),
                        fill: "hsl(var(--muted))",
                      },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={80}
                    strokeWidth={0}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          const total =
                            Number(balanceUSD) + Number(totalSpentUSD);
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={viewBox.cy}
                                className="fill-foreground text-3xl font-bold"
                              >
                                ${total}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 24}
                                className="fill-muted-foreground text-sm"
                              >
                                Total
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>

              {/* Legend */}
              <div className="flex gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted" />
                  <span className="text-sm text-muted-foreground">
                    Available ${balanceUSD}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Spent ${totalSpentUSD}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Stats */}
            <div className="flex flex-col justify-center space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Available Balance
                </p>
                <p className="text-3xl font-bold">${balanceUSD}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Number(balanceUSD) > 0
                    ? `${Math.round((Number(balanceUSD) / (Number(balanceUSD) + Number(totalSpentUSD))) * 100)}% remaining`
                    : "0% remaining"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Total Spent
                </p>
                <p className="text-2xl font-semibold">${totalSpentUSD}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {analytics.actionsCount} campaigns
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Average Cost Per User
                </p>
                <p className="text-2xl font-semibold">
                  $
                  {analytics.totalRedemptions > 0
                    ? (
                        Number(totalSpentUSD) / analytics.totalRedemptions
                      ).toFixed(2)
                    : "0.00"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.totalRedemptions} users sponsored
                </p>
              </div>

              {Number(balanceUSD) < 10 && Number(balanceUSD) > 0 && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium">⚠️ Low Balance</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Consider adding funds to keep campaigns running
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Campaigns</CardTitle>
            <Link href="/sponsor/actions">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentActions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No campaigns yet. Create your first campaign to start sponsoring
                users.
              </p>
              <Link href="/sponsor/actions">
                <Button>Create Campaign</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Redemptions</TableHead>
                  <TableHead>Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActions.map((action) => {
                  const completedCount = action.redemptions.filter(
                    (r) => r.status === "completed",
                  ).length;
                  const totalSpent = action.redemptions
                    .filter((r) => r.status === "completed")
                    .reduce(
                      (sum, r) => sum + BigInt(r.sponsored_amount || "0"),
                      0n,
                    );
                  const spentUSD = (Number(totalSpent) / 1_000_000).toFixed(2);

                  return (
                    <TableRow key={action.id}>
                      <TableCell className="font-medium">
                        {getPluginName(action.pluginId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {action.recurrence === "one_time_per_user"
                            ? "One-time"
                            : "Repeatable"}
                        </Badge>
                      </TableCell>
                      <TableCell>{completedCount}</TableCell>
                      <TableCell>${spentUSD}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
