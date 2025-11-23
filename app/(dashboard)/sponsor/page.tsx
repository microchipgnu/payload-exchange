"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Label, Pie, PieChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface Plugin {
  id: string;
  name: string;
  description?: string;
  schema?: any;
}

export default function SponsorDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentActions, setRecentActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [formData, setFormData] = useState({
    pluginId: "",
    coverageType: "full" as "full" | "percent",
    coveragePercent: 100,
    recurrence: "one_time_per_user" as "one_time_per_user" | "per_request",
    maxPrice: "",
    config: {} as Record<string, any>,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load analytics
      const analyticsRes = await fetch("/api/payload/sponsors/analytics", {
        headers: {
          "x-wallet-address": "0x0000000000000000000000000000000000000000",
        },
      });
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData);

      // Load recent actions
      const actionsRes = await fetch("/api/payload/sponsors/actions", {
        headers: {
          "x-wallet-address": "0x0000000000000000000000000000000000000000",
        },
      });
      const actionsData = await actionsRes.json();
      setRecentActions(actionsData.actions?.slice(0, 5) || []);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    loadData();
    loadPlugins();
  }, [loadData, loadPlugins]);

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
              className="mt-1.5"
            />
          </div>
          <div>
            <FormLabel className="text-sm font-medium">Type</FormLabel>
            <Select
              value={formData.config.type || "text"}
              onValueChange={(value) => updateConfigField("type", value)}
            >
              <SelectTrigger className="mt-1.5">
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
                className="mt-1.5"
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
              className="mt-1.5"
            />
          </div>
          <div>
            <FormLabel className="text-sm font-medium">Button Text</FormLabel>
            <Input
              value={formData.config.buttonText || ""}
              onChange={(e) => updateConfigField("buttonText", e.target.value)}
              placeholder="Submit"
              className="mt-1.5"
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
              className="mt-1.5"
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
              className="mt-1.5"
            />
          </div>
        </>
      );
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const maxPriceInSmallestUnits = BigInt(
        Math.floor(parseFloat(formData.maxPrice) * 1_000_000),
      );

      const res = await fetch("/api/payload/sponsors/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": "0x0000000000000000000000000000000000000000",
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
    }
  };

  const handleFund = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = BigInt(parseFloat(fundAmount) * 1_000_000);
      const res = await fetch("/api/payload/sponsors/fund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": "0x0000000000000000000000000000000000000000",
        },
        body: JSON.stringify({
          amount: amount.toString(),
          currency: "USDC:base",
          network: "base",
        }),
      });

      if (res.ok) {
        setFundAmount("");
        setShowFundModal(false);
        loadData();
      }
    } catch (error) {
      console.error("Failed to fund:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFundModal(true)}>
            Add Funds
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            Create Campaign
          </Button>
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

      {/* Create Campaign Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-2xl">
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
                    <SelectTrigger className="mt-1.5">
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
                  <div className="space-y-4">{renderPluginConfigFields()}</div>
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
                          setFormData({ ...formData, maxPrice: e.target.value })
                        }
                        placeholder="1.00"
                        required
                        className="flex-1"
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
                      <SelectTrigger className="mt-1.5">
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
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
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
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time_per_user">
                          One Time Per User
                        </SelectItem>
                        <SelectItem value="per_request">Per Request</SelectItem>
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
              <Button type="submit" size="default">
                Create Campaign
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Funds Modal */}
      <Dialog open={showFundModal} onOpenChange={setShowFundModal}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-2xl">Add Funds</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Deposit USDC to sponsor user's x401 payments
            </p>
          </DialogHeader>

          <div className="px-6 py-6">
            {/* Current Balance */}
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">
                Current Balance
              </p>
              <p className="text-3xl font-bold">${balanceUSD}</p>
              <p className="text-xs text-muted-foreground mt-1">USDC</p>
            </div>

            {/* Fund Form */}
            <form onSubmit={handleFund} className="space-y-6">
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
                      className="flex-1"
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
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
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
                <Button type="submit" className="flex-1">
                  Add Funds
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
