"use client";

import { useEvmAddress, useIsSignedIn, useSignOut } from "@coinbase/cdp-hooks";
import { SendEvmTransactionButton } from "@coinbase/cdp-react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Label, Pie, PieChart } from "recharts";
import { encodeFunctionData, parseUnits } from "viem";
import { base } from "viem/chains";
import Navbar from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as FormLabel } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WalletAuth } from "@/components/wallet-auth";
import { USDC_CONTRACT_ADDRESS } from "@/lib/config";
import { cn } from "@/lib/utils";

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
  active: boolean;
  maxRedemptionPrice?: string;
  createdAt?: string;
  config?: Record<string, any>;
  redemptions: Array<{
    status: string;
    sponsored_amount: string;
  }>;
}

interface Plugin {
  id: string;
  name: string;
  description?: string;
  schema?: any;
}

export default function SponsorDashboard() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentActions, setRecentActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [treasuryWallet, setTreasuryWallet] = useState<string>("");
  const [fundingTransactionId, setFundingTransactionId] = useState<string>("");
  const [isFunding, setIsFunding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [togglingActions, setTogglingActions] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Action | null>(null);
  const [formData, setFormData] = useState({
    pluginId: "",
    coverageType: "full" as "full" | "percent",
    coveragePercent: 100,
    recurrence: "one_time_per_user" as "one_time_per_user" | "per_request",
    maxPrice: "",
    config: {} as Record<string, any>,
  });

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

  const loadPlugins = useCallback(async () => {
    try {
      const res = await fetch("/api/payload/sponsors/plugins");
      const data = await res.json();
      setPlugins(data.plugins || []);
    } catch (error) {
      console.error("Failed to load plugins:", error);
    }
  }, []);

  useEffect(() => {
    if (evmAddress) {
      loadData();
      loadPlugins();
    }
  }, [loadData, loadPlugins, evmAddress]);

  if (!isSignedIn || !evmAddress) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-8 text-white">
            Sponsor Dashboard
          </h1>
          <Card className="bg-gray-900 border-gray-800 rounded-none">
            <CardContent className="pt-6">
              <WalletAuth />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading || !analytics) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="container mx-auto px-4 py-8 animate-in fade-in duration-300">
          {/* Header Skeleton */}
          <div className="flex justify-between items-center mb-8">
            <div className="h-10 w-64 bg-gray-800 rounded-none animate-pulse" />
            <div className="flex gap-4">
              <div className="h-10 w-32 bg-gray-800 rounded-none animate-pulse" />
              <div className="h-10 w-40 bg-gray-800 rounded-none animate-pulse" />
            </div>
          </div>

          {/* Analytics Card Skeleton */}
          <Card className="mb-6 bg-gray-900 border-gray-800 rounded-none">
            <CardHeader>
              <div className="h-6 w-48 bg-gray-800 rounded-none animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                {/* Chart Skeleton */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-64 h-64 bg-gray-800 rounded-full animate-pulse" />
                  <div className="flex gap-6 mt-4">
                    <div className="h-4 w-24 bg-gray-800 rounded-none animate-pulse" />
                    <div className="h-4 w-24 bg-gray-800 rounded-none animate-pulse" />
                  </div>
                </div>

                {/* Stats Skeleton */}
                <div className="flex flex-col justify-center space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i}>
                      <div className="h-4 w-32 bg-gray-800 rounded-none mb-2 animate-pulse" />
                      <div className="h-8 w-24 bg-gray-800 rounded-none mb-1 animate-pulse" />
                      <div className="h-3 w-40 bg-gray-800 rounded-none animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Campaigns Card Skeleton */}
          <Card className="bg-gray-900 border-gray-800 rounded-none">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="h-6 w-40 bg-gray-800 rounded-none animate-pulse" />
                <div className="h-9 w-24 bg-gray-800 rounded-none animate-pulse" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Table Header Skeleton */}
                <div className="grid grid-cols-9 gap-4 pb-2 border-b border-gray-800">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                    <div
                      key={i}
                      className="h-4 bg-gray-800 rounded-none animate-pulse"
                    />
                  ))}
                </div>
                {/* Table Rows Skeleton */}
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="grid grid-cols-9 gap-4 py-3 border-b border-gray-800 last:border-0"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((j) => (
                      <div
                        key={j}
                        className="h-4 bg-gray-800 rounded-none animate-pulse"
                        style={{
                          animationDelay: `${i * 100}ms`,
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
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

  const handlePluginChange = (pluginId: string) => {
    const plugin = plugins.find((p) => p.id === pluginId);
    setSelectedPlugin(plugin || null);
    setFormData({
      ...formData,
      pluginId,
      config: {},
    });
  };

  const updateConfigField = (key: string, value: any) => {
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        [key]: value,
      },
    });
  };

  const renderPluginConfigFields = () => {
    if (!selectedPlugin) return null;

    const { id: pluginId } = selectedPlugin;

    // Survey plugin
    if (pluginId === "survey") {
      return (
        <>
          <div>
            <FormLabel className="text-sm font-medium">Question *</FormLabel>
            <Input
              value={formData.config.question || ""}
              onChange={(e) => updateConfigField("question", e.target.value)}
              placeholder="What is your favorite color?"
              required
              className="mt-1.5 rounded-none"
            />
          </div>
          <div>
            <FormLabel className="text-sm font-medium">Type</FormLabel>
            <Select
              value={formData.config.type || "text"}
              onValueChange={(value) => updateConfigField("type", value)}
            >
              <SelectTrigger className="mt-1.5 rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.config.type === "multiple-choice" && (
            <div>
              <FormLabel className="text-sm font-medium">
                Options (comma-separated) *
              </FormLabel>
              <Input
                value={
                  Array.isArray(formData.config.options)
                    ? formData.config.options.join(", ")
                    : formData.config.options || ""
                }
                onChange={(e) => {
                  const options = e.target.value
                    .split(",")
                    .map((opt) => opt.trim())
                    .filter((opt) => opt.length > 0);
                  updateConfigField("options", options);
                }}
                placeholder="Option 1, Option 2, Option 3"
                required
                className="mt-1.5 rounded-none"
              />
            </div>
          )}
        </>
      );
    }

    // Email Capture plugin
    if (pluginId === "email-capture") {
      return (
        <>
          <div>
            <FormLabel className="text-sm font-medium">Placeholder</FormLabel>
            <Input
              value={formData.config.placeholder || ""}
              onChange={(e) => updateConfigField("placeholder", e.target.value)}
              placeholder="your@email.com"
              className="mt-1.5 rounded-none"
            />
          </div>
          <div>
            <FormLabel className="text-sm font-medium">Button Text</FormLabel>
            <Input
              value={formData.config.buttonText || ""}
              onChange={(e) => updateConfigField("buttonText", e.target.value)}
              placeholder="Submit"
              className="mt-1.5 rounded-none"
            />
          </div>
        </>
      );
    }

    // GitHub Star plugin
    if (pluginId === "github-star") {
      return (
        <div>
          <FormLabel className="text-sm font-medium">
            Repository (owner/repo) *
          </FormLabel>
          <Input
            value={formData.config.repository || ""}
            onChange={(e) => updateConfigField("repository", e.target.value)}
            placeholder="owner/repository"
            required
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-2 pl-1">
            Example: facebook/react
          </p>
        </div>
      );
    }

    // Code Verification plugin
    if (pluginId === "code-verification") {
      return (
        <>
          <div>
            <FormLabel className="text-sm font-medium">
              Verification Code
            </FormLabel>
            <Input
              value={formData.config.code || ""}
              onChange={(e) => updateConfigField("code", e.target.value)}
              placeholder="Leave empty to auto-generate"
              className="mt-1.5 rounded-none"
            />
            <p className="text-xs text-muted-foreground mt-2 pl-1">
              If left empty, a random code will be generated
            </p>
          </div>
          <div>
            <FormLabel className="text-sm font-medium">Code Length</FormLabel>
            <Input
              type="number"
              min="4"
              max="12"
              value={formData.config.length || 6}
              onChange={(e) =>
                updateConfigField("length", parseInt(e.target.value, 10) || 6)
              }
              className="mt-1.5 rounded-none"
            />
          </div>
        </>
      );
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evmAddress) return;
    setIsCreating(true);
    try {
      const maxPriceInSmallestUnits = BigInt(
        Math.floor(parseFloat(formData.maxPrice) * 1_000_000),
      );

      const res = await fetch("/api/payload/sponsors/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": evmAddress,
        },
        body: JSON.stringify({
          ...formData,
          coveragePercent:
            formData.coverageType === "percent"
              ? formData.coveragePercent
              : undefined,
          maxRedemptionPrice: maxPriceInSmallestUnits.toString(),
          config: formData.config,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setSelectedPlugin(null);
        setFormData({
          pluginId: "",
          coverageType: "full",
          coveragePercent: 100,
          recurrence: "one_time_per_user",
          maxPrice: "",
          config: {},
        });
        loadData();
      }
    } catch (error) {
      console.error("Failed to create action:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleFundInit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evmAddress || !fundAmount) return;
    try {
      const amount = BigInt(parseFloat(fundAmount) * 1_000_000); // Convert to smallest units
      const res = await fetch("/api/payload/sponsors/fund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": evmAddress,
        },
        body: JSON.stringify({
          amount: amount.toString(),
          currency: "USDC:base",
          network: "base",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.treasuryWallet) {
          setTreasuryWallet(data.treasuryWallet);
          setFundingTransactionId(data.fundingTransactionId);
          setIsFunding(true);
        } else if (data.transactionHash) {
          // Already completed
          setFundAmount("");
          setIsFunding(false);
          setShowFundModal(false);
          loadData();
          alert(`Funding successful! Transaction: ${data.transactionHash}`);
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to initialize funding");
      }
    } catch (error) {
      console.error("Failed to fund:", error);
      alert("Failed to initialize funding");
    }
  };

  const handleTransactionSuccess = async (hash: string) => {
    if (!evmAddress || !fundingTransactionId) return;
    try {
      const amount = BigInt(parseFloat(fundAmount) * 1_000_000);
      const res = await fetch("/api/payload/sponsors/fund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": evmAddress,
        },
        body: JSON.stringify({
          amount: amount.toString(),
          transactionHash: hash,
        }),
      });

      if (res.ok) {
        await res.json();
        setFundAmount("");
        setIsFunding(false);
        setTreasuryWallet("");
        setFundingTransactionId("");
        setShowFundModal(false);
        loadData();
        alert(`Funding successful! Transaction: ${hash}`);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to complete funding");
      }
    } catch (error) {
      console.error("Failed to complete funding:", error);
      alert("Failed to complete funding");
    }
  };

  const handleTransactionError = (error: Error) => {
    console.error("Transaction failed:", error);
    alert(`Transaction failed: ${error.message}`);
    setIsFunding(false);
  };

  const toggleActionStatus = async (
    actionId: string,
    currentStatus: boolean,
  ) => {
    if (!evmAddress) return;
    setTogglingActions((prev) => new Set(prev).add(actionId));
    try {
      const res = await fetch(
        `/api/payload/sponsors/actions/${actionId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": evmAddress,
          },
          body: JSON.stringify({ active: !currentStatus }),
        },
      );

      if (res.ok) {
        loadData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to update campaign status");
      }
    } catch (error) {
      console.error("Failed to toggle action status:", error);
      alert("Failed to update campaign status");
    } finally {
      setTogglingActions((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <div className="mt-2">
              <p className="text-sm text-white/70">Wallet Address:</p>
              <p className="text-sm font-mono text-white/90 break-all">
                {evmAddress}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Button
              onClick={signOut}
              variant="outline"
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700 rounded-none"
            >
              Sign Out
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowFundModal(true)}
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700 rounded-none"
            >
              Add Funds
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#EB7D32] hover:bg-[#EB7D32]/90 text-white border-none rounded-none"
            >
              Create Campaign
            </Button>
          </div>
        </div>

        {/* Top Metrics */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className="bg-gray-900 border-gray-800 rounded-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">
                Total Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${balanceUSD}</div>
              <p className="text-xs text-white/70">USDC available</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800 rounded-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">
                Active Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {analytics.actionsCount}
              </div>
              <p className="text-xs text-white/70">Running now</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800 rounded-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">
                Total Redemptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {analytics.totalRedemptions}
              </div>
              <p className="text-xs text-white/70">Users sponsored</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800 rounded-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">
                Total Spent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${totalSpentUSD}
              </div>
              <p className="text-xs text-white/70">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Overview with Donut Chart */}
        <Card className="mb-8 bg-gray-900 border-gray-800 rounded-none">
          <CardHeader>
            <CardTitle className="text-white">Financial Overview</CardTitle>
            <p className="text-sm text-white/70">
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
                    <div className="w-3 h-3 rounded-full bg-gray-600" />
                    <span className="text-sm text-white/70">
                      Available ${balanceUSD}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#EB7D32]" />
                    <span className="text-sm text-white/70">
                      Spent ${totalSpentUSD}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Stats */}
              <div className="flex flex-col justify-center space-y-6">
                <div>
                  <p className="text-sm text-white/70 mb-1">
                    Available Balance
                  </p>
                  <p className="text-3xl font-bold text-white">${balanceUSD}</p>
                  <p className="text-xs text-white/70 mt-1">
                    {Number(balanceUSD) > 0
                      ? `${Math.round((Number(balanceUSD) / (Number(balanceUSD) + Number(totalSpentUSD))) * 100)}% remaining`
                      : "0% remaining"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-white/70 mb-1">Total Spent</p>
                  <p className="text-2xl font-semibold text-white">
                    ${totalSpentUSD}
                  </p>
                  <p className="text-xs text-white/70 mt-1">
                    Across {analytics.actionsCount} campaigns
                  </p>
                </div>

                <div>
                  <p className="text-sm text-white/70 mb-1">
                    Average Cost Per User
                  </p>
                  <p className="text-2xl font-semibold text-white">
                    $
                    {analytics.totalRedemptions > 0
                      ? (
                          Number(totalSpentUSD) / analytics.totalRedemptions
                        ).toFixed(2)
                      : "0.00"}
                  </p>
                  <p className="text-xs text-white/70 mt-1">
                    {analytics.totalRedemptions} users sponsored
                  </p>
                </div>

                {Number(balanceUSD) < 10 && Number(balanceUSD) > 0 && (
                  <div className="bg-gray-800 p-3 rounded-none border border-[#EB7D32]/30">
                    <p className="text-sm font-medium text-white">
                      ⚠️ Low Balance
                    </p>
                    <p className="text-xs text-white/70 mt-1">
                      Consider adding funds to keep campaigns running
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Campaigns */}
        <Card className="bg-gray-900 border-gray-800 rounded-none">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-white">Recent Campaigns</CardTitle>
              <Link href="/sponsor/actions">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-gray-800 rounded-none"
                >
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentActions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/70 mb-4">
                  No campaigns yet. Create your first campaign to start
                  sponsoring users.
                </p>
                <Link href="/sponsor/actions">
                  <Button className="bg-[#EB7D32] hover:bg-[#EB7D32]/90 text-white border-none rounded-none">
                    Create Campaign
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    <TableHead className="text-white/70">Campaign</TableHead>
                    <TableHead className="text-white/70">Status</TableHead>
                    <TableHead className="text-white/70">Type</TableHead>
                    <TableHead className="text-white/70">Max Price</TableHead>
                    <TableHead className="text-white/70">Coverage</TableHead>
                    <TableHead className="text-white/70">Redemptions</TableHead>
                    <TableHead className="text-white/70">Spent</TableHead>
                    <TableHead className="text-white/70">Created</TableHead>
                    <TableHead className="text-white/70">Actions</TableHead>
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
                    const spentUSD = (Number(totalSpent) / 1_000_000).toFixed(
                      2,
                    );
                    const maxPriceUSD = action.maxRedemptionPrice
                      ? (Number(action.maxRedemptionPrice) / 1_000_000).toFixed(
                          2,
                        )
                      : "N/A";
                    const coverageText =
                      action.coverageType === "full"
                        ? "100%"
                        : `${action.coveragePercent || 0}%`;
                    const isToggling = togglingActions.has(action.id);

                    return (
                      <TableRow
                        key={action.id}
                        className={`border-gray-800 hover:bg-gray-800/50 ${
                          !action.active ? "opacity-60" : ""
                        }`}
                      >
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            onClick={() => setSelectedCampaign(action)}
                            className="text-white hover:text-[#EB7D32] transition-colors cursor-pointer text-left"
                          >
                            {getPluginName(action.pluginId)}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-none ${
                              action.active
                                ? "border-green-600 text-green-400 bg-green-950/20"
                                : "border-gray-600 text-gray-400 bg-gray-950/20"
                            }`}
                          >
                            {action.active ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-gray-700 text-white/70 rounded-none"
                          >
                            {action.recurrence === "one_time_per_user"
                              ? "One-time"
                              : "Repeatable"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white">
                          ${maxPriceUSD}
                        </TableCell>
                        <TableCell className="text-white/70">
                          {coverageText}
                        </TableCell>
                        <TableCell className="text-white">
                          {completedCount}
                        </TableCell>
                        <TableCell className="text-white">
                          ${spentUSD}
                        </TableCell>
                        <TableCell className="text-white/70 text-sm">
                          {formatDate(action.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              toggleActionStatus(action.id, action.active)
                            }
                            disabled={isToggling}
                            className={`rounded-none ${
                              action.active
                                ? "bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
                                : "bg-[#EB7D32] hover:bg-[#EB7D32]/90 text-white border-none"
                            }`}
                          >
                            {isToggling ? (
                              <span className="flex items-center gap-1">
                                <svg
                                  className="animate-spin h-3 w-3"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                              </span>
                            ) : action.active ? (
                              "Disable"
                            ) : (
                              "Enable"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Campaign Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 bg-gray-900 border-gray-800 rounded-none">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle className="text-2xl text-white">
                Create New Sponsor Campaign
              </DialogTitle>
            </DialogHeader>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                {/* Section 1: Action Type */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold mb-1">
                      What action do you want users to take?
                    </h3>
                  </div>
                  <div>
                    <FormLabel className="text-sm font-medium">
                      Action Type
                    </FormLabel>
                    <Select
                      value={formData.pluginId}
                      onValueChange={handlePluginChange}
                    >
                      <SelectTrigger className="mt-1.5 rounded-none">
                        <SelectValue placeholder="Select an action type" />
                      </SelectTrigger>
                      <SelectContent>
                        {plugins.map((plugin) => (
                          <SelectItem key={plugin.id} value={plugin.id}>
                            {plugin.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPlugin?.description && (
                      <p className="text-sm text-muted-foreground mt-2 pl-1">
                        {selectedPlugin.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Section 2: Plugin Configuration */}
                {selectedPlugin && (
                  <div className="space-y-4 pt-6 border-t">
                    <div>
                      <h3 className="text-base font-semibold mb-1">
                        Configure Action Details
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Customize how this action works
                      </p>
                    </div>
                    <div className="space-y-4">
                      {renderPluginConfigFields()}
                    </div>
                  </div>
                )}

                {/* Section 3: Sponsorship Settings */}
                <div className="space-y-4 pt-6 border-t">
                  <div>
                    <h3 className="text-base font-semibold mb-1">
                      Sponsorship Settings
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Define how much you'll pay and how often
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Max Price */}
                    <div className="col-span-2">
                      <FormLabel className="text-sm font-medium">
                        Max Sponsored Amount (USDC) per one redemption
                      </FormLabel>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={formData.maxPrice}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              maxPrice: e.target.value,
                            })
                          }
                          placeholder="1.00"
                          required
                          className="flex-1 rounded-none"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          USDC
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 pl-1">
                        Maximum you'll pay per user who completes this action
                      </p>
                    </div>

                    {/* Coverage Type */}
                    <div>
                      <FormLabel className="text-sm font-medium">
                        Coverage Type
                      </FormLabel>
                      <Select
                        value={formData.coverageType}
                        onValueChange={(value: "full" | "percent") =>
                          setFormData({ ...formData, coverageType: value })
                        }
                      >
                        <SelectTrigger className="mt-1.5 rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full Coverage</SelectItem>
                          <SelectItem value="percent">
                            Percentage Coverage
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Coverage Percent (conditional) */}
                    {formData.coverageType === "percent" && (
                      <div>
                        <FormLabel className="text-sm font-medium">
                          Coverage Percent
                        </FormLabel>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.coveragePercent}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                coveragePercent:
                                  parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="flex-1 rounded-none"
                          />
                          <span className="text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Recurrence */}
                    <div
                      className={
                        formData.coverageType === "percent" ? "" : "col-span-2"
                      }
                    >
                      <FormLabel className="text-sm font-medium">
                        Recurrence
                      </FormLabel>
                      <Select
                        value={formData.recurrence}
                        onValueChange={(
                          value: "one_time_per_user" | "per_request",
                        ) => setFormData({ ...formData, recurrence: value })}
                      >
                        <SelectTrigger className="mt-1.5 rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one_time_per_user">
                            One Time Per User
                          </SelectItem>
                          <SelectItem value="per_request">
                            Per Request
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2 pl-1">
                        {formData.recurrence === "one_time_per_user"
                          ? "Each user can only redeem once"
                          : "Users can redeem multiple times"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t bg-muted/30 flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="default" disabled={isCreating}>
                  {isCreating ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    "Create Campaign"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Funds Modal */}
        <Dialog
          open={showFundModal}
          onOpenChange={(open) => {
            setShowFundModal(open);
            if (!open) {
              setIsFunding(false);
              setTreasuryWallet("");
              setFundingTransactionId("");
              setFundAmount("");
            }
          }}
        >
          <DialogContent className="max-w-md p-0 bg-gray-900 border-gray-800 rounded-none">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-800">
              <DialogTitle className="text-2xl text-white">
                Add Funds
              </DialogTitle>
              <p className="text-sm text-white/70 mt-1">
                Deposit USDC to sponsor user's x401 payments
              </p>
            </DialogHeader>

            <div className="px-6 py-6">
              {/* Current Balance */}
              <div className="mb-6 p-4 bg-gray-800 rounded-none border border-gray-700">
                <p className="text-sm text-muted-foreground mb-1">
                  Current Balance
                </p>
                <p className="text-3xl font-bold">${balanceUSD}</p>
                <p className="text-xs text-muted-foreground mt-1">USDC</p>
              </div>

              {/* Fund Form */}
              {!isFunding ? (
                <form onSubmit={handleFundInit} className="space-y-6">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-base font-semibold mb-1">
                        How much would you like to add?
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Enter the amount in USDC
                      </p>
                    </div>

                    <div>
                      <FormLabel className="text-sm font-medium">
                        Amount (USDC)
                      </FormLabel>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={fundAmount}
                          onChange={(e) => setFundAmount(e.target.value)}
                          placeholder="10.00"
                          required
                          className="flex-1 rounded-none"
                          disabled={isFunding}
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          USDC
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 pl-1">
                        Minimum: 0.01 USDC
                      </p>
                    </div>

                    {/* Preview */}
                    {fundAmount && parseFloat(fundAmount) > 0 && (
                      <div className="p-3 bg-gray-800 border border-[#EB7D32]/30 rounded-none">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">
                            New balance:
                          </span>
                          <span className="font-semibold">
                            $
                            {(
                              parseFloat(balanceUSD) + parseFloat(fundAmount)
                            ).toFixed(2)}{" "}
                            USDC
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowFundModal(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isFunding}
                    >
                      {isFunding ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        "Initialize Funding"
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-none border border-[#EB7D32]/30 bg-gray-800 px-4 py-3">
                    <p className="text-sm text-white">
                      Send {fundAmount} USDC to treasury wallet
                    </p>
                    <div className="mt-2 space-y-1">
                      <div>
                        <p className="text-xs text-white/70">
                          Treasury Wallet:
                        </p>
                        <p className="text-xs text-white/90 break-all font-mono">
                          {treasuryWallet}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/70">USDC Contract:</p>
                        <p className="text-xs text-white/90 break-all font-mono">
                          {USDC_CONTRACT_ADDRESS}
                        </p>
                      </div>
                    </div>
                  </div>
                  <SendEvmTransactionButton
                    account={evmAddress}
                    network="base"
                    onError={handleTransactionError}
                    onSuccess={handleTransactionSuccess}
                    pendingLabel="Sending transaction..."
                    transaction={{
                      to: USDC_CONTRACT_ADDRESS as `0x${string}`,
                      value: 0n, // No native ETH sent for ERC20 transfers
                      data: encodeFunctionData({
                        abi: [
                          {
                            name: "transfer",
                            type: "function",
                            stateMutability: "nonpayable",
                            inputs: [
                              { name: "to", type: "address" },
                              { name: "amount", type: "uint256" },
                            ],
                            outputs: [{ name: "", type: "bool" }],
                          },
                        ],
                        functionName: "transfer",
                        args: [
                          treasuryWallet as `0x${string}`,
                          parseUnits(fundAmount, 6), // USDC has 6 decimals
                        ],
                      }),
                      chainId: base.id,
                      type: "eip1559",
                    }}
                  >
                    <button
                      type="button"
                      className={cn(buttonVariants({ className: "w-full" }))}
                    >
                      Send {fundAmount} USDC
                    </button>
                  </SendEvmTransactionButton>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setIsFunding(false);
                      setTreasuryWallet("");
                      setFundingTransactionId("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Campaign Configuration Modal */}
        <Dialog
          open={selectedCampaign !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedCampaign(null);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 bg-gray-900 border-gray-800 rounded-none">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-800">
              <DialogTitle className="text-2xl text-white">
                Campaign Configuration
              </DialogTitle>
              {selectedCampaign && (
                <p className="text-sm text-white/70 mt-1">
                  {getPluginName(selectedCampaign.pluginId)}
                </p>
              )}
            </DialogHeader>

            {selectedCampaign && (
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-white border-b border-gray-800 pb-2">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-white/70 mb-1">Campaign ID</p>
                      <p className="text-sm text-white font-mono break-all">
                        {selectedCampaign.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-white/70 mb-1">Status</p>
                      <Badge
                        variant="outline"
                        className={`rounded-none ${
                          selectedCampaign.active
                            ? "border-green-600 text-green-400 bg-green-950/20"
                            : "border-gray-600 text-gray-400 bg-gray-950/20"
                        }`}
                      >
                        {selectedCampaign.active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-white/70 mb-1">Created</p>
                      <p className="text-sm text-white">
                        {formatDate(selectedCampaign.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-white/70 mb-1">Action Type</p>
                      <p className="text-sm text-white">
                        {getPluginName(selectedCampaign.pluginId)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sponsorship Settings */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-white border-b border-gray-800 pb-2">
                    Sponsorship Settings
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-white/70 mb-1">
                        Max Sponsored Amount
                      </p>
                      <p className="text-lg font-semibold text-white">
                        $
                        {selectedCampaign.maxRedemptionPrice
                          ? (
                              Number(selectedCampaign.maxRedemptionPrice) /
                              1_000_000
                            ).toFixed(2)
                          : "N/A"}{" "}
                        USDC
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-white/70 mb-1">
                        Coverage Type
                      </p>
                      <p className="text-sm text-white capitalize">
                        {selectedCampaign.coverageType === "full"
                          ? "Full Coverage"
                          : "Percentage Coverage"}
                      </p>
                      {selectedCampaign.coverageType === "percent" && (
                        <p className="text-xs text-white/70 mt-1">
                          {selectedCampaign.coveragePercent || 0}% coverage
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white/70 mb-1">Recurrence</p>
                      <Badge
                        variant="outline"
                        className="border-gray-700 text-white/70 rounded-none"
                      >
                        {selectedCampaign.recurrence === "one_time_per_user"
                          ? "One-time Per User"
                          : "Per Request"}
                      </Badge>
                      <p className="text-xs text-white/70 mt-1">
                        {selectedCampaign.recurrence === "one_time_per_user"
                          ? "Each user can redeem once"
                          : "Users can redeem multiple times"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-white/70 mb-1">Statistics</p>
                      <div className="space-y-1">
                        <p className="text-sm text-white">
                          Redemptions:{" "}
                          {
                            selectedCampaign.redemptions.filter(
                              (r) => r.status === "completed",
                            ).length
                          }
                        </p>
                        <p className="text-sm text-white">
                          Total Spent: $
                          {(
                            Number(
                              selectedCampaign.redemptions
                                .filter((r) => r.status === "completed")
                                .reduce(
                                  (sum, r) =>
                                    sum + BigInt(r.sponsored_amount || "0"),
                                  0n,
                                ),
                            ) / 1_000_000
                          ).toFixed(2)}{" "}
                          USDC
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Configuration */}
                {selectedCampaign.config &&
                  Object.keys(selectedCampaign.config).length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white border-b border-gray-800 pb-2">
                        Action Configuration
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(selectedCampaign.config).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="bg-gray-800 p-3 rounded-none border border-gray-700"
                            >
                              <p className="text-sm font-medium text-white/70 mb-1 capitalize">
                                {key.replace(/([A-Z])/g, " $1").trim()}
                              </p>
                              <p className="text-sm text-white break-words">
                                {Array.isArray(value)
                                  ? value.join(", ")
                                  : typeof value === "object"
                                    ? JSON.stringify(value, null, 2)
                                    : String(value)}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setSelectedCampaign(null)}
                className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700 rounded-none"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
