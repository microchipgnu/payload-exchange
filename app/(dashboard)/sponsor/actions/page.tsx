"use client";

import { useEvmAddress, useIsSignedIn, useSignOut } from "@coinbase/cdp-hooks";
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
import { WalletAuth } from "@/components/wallet-auth";

interface Action {
  id: string;
  pluginId: string;
  coverageType: "full" | "percent";
  coveragePercent?: number;
  recurrence: "one_time_per_user" | "per_request";
  config: Record<string, any>;
  max_redemption_price: string;
  active: boolean;
  createdAt: string;
  redemptions?: Array<{
    id: string;
    userId: string;
    status: string;
    sponsored_amount: string;
    createdAt: string;
    completedAt?: string;
  }>;
}

interface Plugin {
  id: string;
  name: string;
  description?: string;
  schema?: any;
}

export default function SponsorActionsPage() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
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

  const loadBalance = useCallback(async () => {
    if (!evmAddress) return;
    try {
      const res = await fetch("/api/payload/sponsors/analytics", {
        headers: {
          "x-wallet-address": evmAddress,
        },
      });
      const data = await res.json();
      setBalance(data.balance || "0");
    } catch (error) {
      console.error("Failed to load balance:", error);
    }
  }, [evmAddress]);

  const loadActions = useCallback(async () => {
    if (!evmAddress) return;
    try {
      const res = await fetch("/api/payload/sponsors/actions", {
        headers: {
          "x-wallet-address": evmAddress,
        },
      });
      const data = await res.json();
      setActions(data.actions || []);
    } catch (error) {
      console.error("Failed to load actions:", error);
    }
  }, [evmAddress]);

  useEffect(() => {
    loadPlugins();
    if (evmAddress) {
      loadActions();
      loadBalance();
    }
  }, [loadPlugins, loadActions, loadBalance, evmAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evmAddress) return;
    try {
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
          config: formData.config,
          max_redemption_price: "1000000", // 1 USDC default
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
          config: {},
        });
        loadActions();
        loadBalance();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to create action");
      }
    } catch (error) {
      console.error("Failed to create action:", error);
      alert("Failed to create action");
    }
  };

  const handleToggleAction = async (actionId: string, currentStatus: boolean) => {
    if (!evmAddress) return;
    try {
      const res = await fetch(`/api/payload/sponsors/actions/${actionId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": evmAddress,
        },
        body: JSON.stringify({
          active: !currentStatus,
        }),
      });

      if (res.ok) {
        loadActions();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to update action status");
      }
    } catch (error) {
      console.error("Failed to update action status:", error);
      alert("Failed to update action status");
    }
  };

  const renderPluginConfigFields = () => {
    if (!selectedPlugin) return null;

    const { id: pluginId, schema } = selectedPlugin;

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
                updateConfigField("length", parseInt(e.target.value) || 6)
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

  if (!isSignedIn || !evmAddress) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Actions</h1>
        <Card>
          <CardContent className="pt-6">
            <WalletAuth />
          </CardContent>
        </Card>
      </div>
    );
  }

  const balanceUSD = (BigInt(balance) / BigInt(1_000_000)).toString();
  const hasBalance = BigInt(balance) > 0n;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold">Actions</h1>
          <div className="mt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Wallet Address:
            </p>
            <p className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
              {evmAddress}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={signOut} variant="outline" size="sm">
            Sign Out
          </Button>
          <div className="text-right">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Balance
            </p>
            <p className="text-lg font-semibold">${balanceUSD} USDC</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} disabled={!hasBalance}>
            {showForm ? "Cancel" : "Create Action"}
          </Button>
        </div>
      </div>

      {!hasBalance && (
        <Card className="mb-8 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  clipRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  fillRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-medium text-yellow-900 text-sm dark:text-yellow-100">
                  Insufficient Balance
                </p>
                <p className="text-yellow-700 text-sm dark:text-yellow-300 mt-1">
                  You need to fund your account before creating actions.{" "}
                  <a href="/sponsor/billing" className="underline">
                    Go to Billing
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                        coveragePercent: parseInt(e.target.value) || 0,
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

              <Button type="submit">Create Action</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400 text-center py-8">
              No actions created yet. Create your first action above.
            </p>
          ) : (
            <div className="space-y-4">
              {actions.map((action) => {
                const maxPriceUSD = (
                  BigInt(action.max_redemption_price) / BigInt(1_000_000)
                ).toString();
                const redemptionsCount = action.redemptions?.length || 0;
                const completedRedemptions =
                  action.redemptions?.filter((r) => r.status === "completed")
                    .length || 0;
                const createdDate = new Date(action.createdAt).toLocaleDateString();

                return (
                  <Card key={action.id} className={!action.active ? "opacity-60" : ""}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {action.pluginId}
                            {!action.active && (
                              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                Disabled
                              </span>
                            )}
                          </CardTitle>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Created: {createdDate}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleToggleAction(action.id, action.active)}
                          variant={action.active ? "destructive" : "default"}
                          size="sm"
                        >
                          {action.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold mb-2">Configuration</p>
                          <div className="space-y-1 text-sm">
                            <p>
                              <span className="text-slate-600 dark:text-slate-400">
                                Coverage:
                              </span>{" "}
                              {action.coverageType === "full"
                                ? "100%"
                                : `${action.coveragePercent}%`}
                            </p>
                            <p>
                              <span className="text-slate-600 dark:text-slate-400">
                                Recurrence:
                              </span>{" "}
                              {action.recurrence.replace(/_/g, " ")}
                            </p>
                            <p>
                              <span className="text-slate-600 dark:text-slate-400">
                                Max Price:
                              </span>{" "}
                              ${maxPriceUSD} USDC
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold mb-2">Statistics</p>
                          <div className="space-y-1 text-sm">
                            <p>
                              <span className="text-slate-600 dark:text-slate-400">
                                Total Redemptions:
                              </span>{" "}
                              {redemptionsCount}
                            </p>
                            <p>
                              <span className="text-slate-600 dark:text-slate-400">
                                Completed:
                              </span>{" "}
                              {completedRedemptions}
                            </p>
                            <p>
                              <span className="text-slate-600 dark:text-slate-400">
                                Pending:
                              </span>{" "}
                              {redemptionsCount - completedRedemptions}
                            </p>
                          </div>
                        </div>
                      </div>
                      {Object.keys(action.config).length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-semibold mb-2">Plugin Config</p>
                          <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-x-auto">
                            {JSON.stringify(action.config, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
