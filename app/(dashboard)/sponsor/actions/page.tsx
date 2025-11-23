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
  resourceId: string;
  coverageType: "full" | "percent";
  coveragePercent?: number;
  recurrence: "one_time_per_user" | "per_request";
  config: Record<string, any>;
}

export default function SponsorActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [plugins, setPlugins] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    pluginId: "",
    resourceId: "",
    coverageType: "full" as "full" | "percent",
    coveragePercent: 100,
    recurrence: "one_time_per_user" as "one_time_per_user" | "per_request",
    config: "{}",
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

  useEffect(() => {
    loadPlugins();
    loadActions();
  }, [loadPlugins, loadActions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let config: Record<string, any> = {};
      try {
        config = JSON.parse(formData.config);
      } catch {
        alert("Invalid JSON config");
        return;
      }

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
          config,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setFormData({
          pluginId: "",
          resourceId: "",
          coverageType: "full",
          coveragePercent: 100,
          recurrence: "one_time_per_user",
          config: "{}",
        });
        loadActions();
      }
    } catch (error) {
      console.error("Failed to create action:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Actions</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Create Action"}
        </Button>
      </div>

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
                  onValueChange={(value) =>
                    setFormData({ ...formData, pluginId: value })
                  }
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
              </div>

              <div>
                <Label>Resource ID</Label>
                <Input
                  value={formData.resourceId}
                  onChange={(e) =>
                    setFormData({ ...formData, resourceId: e.target.value })
                  }
                  placeholder="https://api.example.com/endpoint"
                />
              </div>

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

              <div>
                <Label>Config (JSON)</Label>
                <Textarea
                  value={formData.config}
                  onChange={(e) =>
                    setFormData({ ...formData, config: e.target.value })
                  }
                  placeholder='{"question": "What is your favorite color?"}'
                />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plugin</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Recurrence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((action) => (
                <TableRow key={action.id}>
                  <TableCell>{action.pluginId}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {action.resourceId}
                  </TableCell>
                  <TableCell>
                    {action.coverageType === "full"
                      ? "100%"
                      : `${action.coveragePercent}%`}
                  </TableCell>
                  <TableCell>{action.recurrence}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
