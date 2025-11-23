"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SponsorBillingPage() {
  const [balance, setBalance] = useState<string>("0");
  const [fundAmount, setFundAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/payload/sponsors/analytics", {
        headers: {
          "x-wallet-address": "0x0000000000000000000000000000000000000000", // TODO: Get from wallet
        },
      });
      const data = await res.json();
      setBalance(data.balance || "0");
    } catch (error) {
      console.error("Failed to load balance:", error);
    }
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const handleFund = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = BigInt(parseFloat(fundAmount) * 1_000_000); // Convert to smallest units
      const res = await fetch("/api/payload/sponsors/fund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": "0x0000000000000000000000000000000000000000", // TODO: Get from wallet
        },
        body: JSON.stringify({
          amount: amount.toString(),
          currency: "USDC:base",
          network: "base",
        }),
      });

      if (res.ok) {
        setFundAmount("");
        loadBalance();
      }
    } catch (error) {
      console.error("Failed to fund:", error);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = BigInt(parseFloat(withdrawAmount) * 1_000_000); // Convert to smallest units
      const res = await fetch("/api/payload/sponsors/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": "0x0000000000000000000000000000000000000000", // TODO: Get from wallet
        },
        body: JSON.stringify({
          amount: amount.toString(),
        }),
      });

      if (res.ok) {
        setWithdrawAmount("");
        loadBalance();
      }
    } catch (error) {
      console.error("Failed to withdraw:", error);
    }
  };

  const balanceUSD = (BigInt(balance) / BigInt(1_000_000)).toString();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Billing</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">${balanceUSD} USDC</p>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Available for sponsoring actions
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Fund Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFund} className="space-y-4">
              <div>
                <Label>Amount (USDC)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="10.00"
                />
              </div>
              <Button type="submit" className="w-full">
                Fund Account
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Withdraw</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <Label>Amount (USDC)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="10.00"
                />
              </div>
              <Button type="submit" className="w-full" variant="outline">
                Withdraw
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
