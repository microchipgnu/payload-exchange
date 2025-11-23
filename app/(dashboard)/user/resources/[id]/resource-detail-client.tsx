"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ResourceDetailClientProps {
  resourceId: string;
  resourceUrl: string;
}

export default function ResourceDetailClient({
  resourceId,
  resourceUrl,
}: ResourceDetailClientProps) {
  const [actionData, setActionData] = useState<any>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAccess = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payload/proxy/${resourceId}`, {
        method: "POST",
        headers: {
          "x-user-id": "user-123", // TODO: Get from auth
        },
      });

      const data = await res.json();

      if (data.type === "action_required") {
        setActionData(data);
      } else {
        // Success - resource accessed
        alert("Resource accessed successfully!");
      }
    } catch (error) {
      console.error("Failed to access resource:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAction = async () => {
    if (!actionData) return;

    setLoading(true);
    try {
      const res = await fetch("/api/payload/actions/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionInstanceId: actionData.actionInstanceId,
          input: { answer: input }, // Simplified - adjust based on plugin
          userId: "user-123", // TODO: Get from auth
        }),
      });

      const data = await res.json();

      if (data.status === "completed") {
        alert("Action completed! Resource accessed.");
        setActionData(null);
        setInput("");
      } else {
        alert(`Action failed: ${data.reason || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to validate action:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Access Resource</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Access this resource via Payload Exchange
          </p>
          {!actionData && (
            <Button onClick={handleAccess} disabled={loading}>
              {loading ? "Loading..." : "Access via Payload"}
            </Button>
          )}
        </CardContent>
      </Card>

      {actionData && (
        <Card>
          <CardHeader>
            <CardTitle>Complete Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{actionData.instructions}</p>
            {actionData.url && (
              <a
                href={actionData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {actionData.url}
              </a>
            )}
            <div>
              <Label>Your Answer</Label>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your response..."
              />
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p>
                Sponsor Contribution: $
                {(
                  BigInt(actionData.coverage.sponsorContribution) /
                  BigInt(1_000_000)
                ).toString()}{" "}
                USDC
              </p>
              <p>
                Your Contribution: $
                {(
                  BigInt(actionData.coverage.userContribution) /
                  BigInt(1_000_000)
                ).toString()}{" "}
                USDC
              </p>
            </div>
            <Button onClick={handleSubmitAction} disabled={loading}>
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
