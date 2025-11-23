"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";

interface Action {
  id: string;
  pluginId: string;
  coverageType: "full" | "percent";
  coveragePercent?: number;
  recurrence: "one_time_per_user" | "per_request";
  config: Record<string, any>;
  maxRedemptionPrice: string;
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

export default function SponsorActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [balance, setBalance] = useState<string>("0");
  const [formData, setFormData] = useState({
    pluginId: "",
    coverageType: "full" as "full" | "percent",
    coveragePercent: 100,
    recurrence: "one_time_per_user" as "one_time_per_user" | "per_request",
    maxPrice: "",
    config: {} as Record<string, any>,
  });

  const loadPlugins = useCallback(async () => {
    try {
      const res = await fetch("/api/payload/sponsors/plugins");
      const data = await res.json();
      setPlugins(data.plugins || []);
    } catch (error) {
      console.error("Failed to load plugins:", error);
    }
  }, []);

  const handlePluginChange = (pluginId: string) => {
    const plugin = plugins.find((p) => p.id === pluginId);
    setSelectedPlugin(plugin || null);
    setFormData({
      ...formData,
      pluginId,
      config: {}, // Reset config when plugin changes
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

  const loadActions = useCallback(async () => {
    try {
      const res = await fetch("/api/payload/sponsors/actions", {
        headers: {
          "x-wallet-address": "0x0000000000000000000000000000000000000000", // TODO: Get from wallet
        },
      });
      const data = await res.json();
      setActions(data.actions || []);
    } catch (error) {
      console.error("Failed to load actions:", error);
    }
  }, []);

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/payload/sponsors/analytics", {
        headers: {
          "x-wallet-address": "0x0000000000000000000000000000000000000000",
        },
      });
      const data = await res.json();
      setBalance(data.balance || "0");
    } catch (error) {
      console.error("Failed to load balance:", error);
    }
  }, []);

  useEffect(() => {
    loadPlugins();
    loadActions();
    loadBalance();
  }, [loadPlugins, loadActions, loadBalance]);

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
          "x-wallet-address": "0x0000000000000000000000000000000000000000", // TODO: Get from wallet
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
        setShowForm(false);
        setSelectedPlugin(null);
        setFormData({
          pluginId: "",
          coverageType: "full",
          coveragePercent: 100,
          recurrence: "one_time_per_user",
          maxPrice: "",
          config: {},
        });
        loadActions();
      }
    } catch (error) {
      console.error("Failed to create action:", error);
    }
  };

  const renderPluginConfigFields = () => {
    if (!selectedPlugin) return null;

    const { id: pluginId } = selectedPlugin;

    // Survey plugin
    if (pluginId === "survey") {
      return (
        <>
          <div>
            <Label>Question *</Label>
            <Input
              value={formData.config.question || ""}
              onChange={(e) => updateConfigField("question", e.target.value)}
              placeholder="What is your favorite color?"
              required
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select
              value={formData.config.type || "text"}
              onValueChange={(value) => updateConfigField("type", value)}
            >
              <SelectTrigger>
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
              <Label>Options (comma-separated) *</Label>
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
            <Label>Placeholder</Label>
            <Input
              value={formData.config.placeholder || ""}
              onChange={(e) => updateConfigField("placeholder", e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          <div>
            <Label>Button Text</Label>
            <Input
              value={formData.config.buttonText || ""}
              onChange={(e) => updateConfigField("buttonText", e.target.value)}
              placeholder="Submit"
            />
          </div>
        </>
      );
    }

    // GitHub Star plugin
    if (pluginId === "github-star") {
      return (
        <div>
          <Label>Repository (owner/repo) *</Label>
          <Input
            value={formData.config.repository || ""}
            onChange={(e) => updateConfigField("repository", e.target.value)}
            placeholder="owner/repository"
            required
          />
          <p className="text-sm text-muted-foreground mt-1">
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
            <Label>Verification Code</Label>
            <Input
              value={formData.config.code || ""}
              onChange={(e) => updateConfigField("code", e.target.value)}
              placeholder="Leave empty to auto-generate"
            />
            <p className="text-sm text-muted-foreground mt-1">
              If left empty, a random code will be generated
            </p>
          </div>
          <div>
            <Label>Code Length</Label>
            <Input
              type="number"
              min="4"
              max="12"
              value={formData.config.length || 6}
              onChange={(e) =>
                updateConfigField("length", parseInt(e.target.value, 10) || 6)
              }
            />
          </div>
        </>
      );
    }

    // Fallback: show JSON editor for unknown plugins
    return (
      <div>
        <Label>Config (JSON)</Label>
        <Textarea
          value={JSON.stringify(formData.config, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setFormData({ ...formData, config: parsed });
            } catch {
              // Invalid JSON, but allow typing
            }
          }}
          placeholder='{"key": "value"}'
          className="font-mono text-sm"
        />
      </div>
    );
  };

  const balanceUSD = (BigInt(balance) / BigInt(1_000_000)).toString();

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Create Campaign"}
        </Button>
      </div>

      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-3xl font-bold">${balanceUSD} USDC</p>
            </div>
            <p className="text-sm text-muted-foreground">
              This balance is used to sponsor user transactions
            </p>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Action</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Plugin</Label>
                <Select
                  value={formData.pluginId}
                  onValueChange={handlePluginChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select plugin" />
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
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedPlugin.description}
                  </p>
                )}
              </div>

              {selectedPlugin && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">
                    Plugin Configuration
                  </h3>
                  <div className="space-y-4">{renderPluginConfigFields()}</div>
                </div>
              )}

              <div>
                <Label>Coverage Type</Label>
                <Select
                  value={formData.coverageType}
                  onValueChange={(value: "full" | "percent") =>
                    setFormData({ ...formData, coverageType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Coverage</SelectItem>
                    <SelectItem value="percent">Percentage Coverage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.coverageType === "percent" && (
                <div>
                  <Label>Coverage Percent</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.coveragePercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        coveragePercent: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>
              )}

              <div>
                <Label>Recurrence</Label>
                <Select
                  value={formData.recurrence}
                  onValueChange={(value: "one_time_per_user" | "per_request") =>
                    setFormData({ ...formData, recurrence: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time_per_user">
                      One Time Per User
                    </SelectItem>
                    <SelectItem value="per_request">Per Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Max Price Per User (USDC)</Label>
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
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum amount you'll pay per user redemption
                </p>
              </div>

              <Button type="submit">Create Action</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No campaigns yet. Create your first campaign to start sponsoring
                users.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Max Price</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Recurrence</TableHead>
                  <TableHead>Redemptions</TableHead>
                  <TableHead>Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.map((action) => {
                  const completedCount =
                    action.redemptions?.filter((r) => r.status === "completed")
                      .length || 0;
                  const totalSpent =
                    action.redemptions
                      ?.filter((r) => r.status === "completed")
                      .reduce(
                        (sum, r) => sum + BigInt(r.sponsored_amount || "0"),
                        0n,
                      ) || 0n;
                  const spentUSD = (Number(totalSpent) / 1_000_000).toFixed(2);
                  const maxPriceUSD = (
                    Number(BigInt(action.maxRedemptionPrice || "0")) / 1_000_000
                  ).toFixed(2);

                  return (
                    <TableRow key={action.id}>
                      <TableCell className="font-medium">
                        {getPluginName(action.pluginId)}
                      </TableCell>
                      <TableCell>${maxPriceUSD}</TableCell>
                      <TableCell>
                        {action.coverageType === "full"
                          ? "100%"
                          : `${action.coveragePercent}%`}
                      </TableCell>
                      <TableCell>
                        {action.recurrence === "one_time_per_user"
                          ? "One-time"
                          : "Repeatable"}
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
