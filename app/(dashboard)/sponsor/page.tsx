"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SponsorHomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Sponsor Dashboard</h1>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Link href="/sponsor/actions">
          <Card className="hover:border-primary cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400">
                Configure and manage actions for your sponsored resources.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sponsor/billing">
          <Card className="hover:border-primary cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle>Billing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400">
                Fund your account and manage withdrawals.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sponsor/analytics">
          <Card className="hover:border-primary cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400">
                View spending overview and redemption statistics.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
