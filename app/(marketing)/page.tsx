"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100">
            Get All APIs for Free
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
            Access premium APIs by completing simple actions. No payment
            required.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/user">
              <Button size="lg">Browse Resources</Button>
            </Link>
            <Link href="/sponsor">
              <Button size="lg" variant="outline">
                Become a Sponsor
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <CardTitle>Simple Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400">
                Complete simple tasks like email capture, surveys, or GitHub
                stars to unlock API access.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>No Payment Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400">
                Sponsors cover the costs. You just complete actions to access
                premium APIs.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instant Access</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400">
                Get immediate access to APIs after completing actions. No
                waiting, no delays.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-slate-100">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mt-8">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">1</div>
              <h3 className="text-xl font-semibold mb-2">Find a Resource</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Browse available APIs and find what you need.
              </p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">2</div>
              <h3 className="text-xl font-semibold mb-2">Complete Action</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Complete a simple action like email capture or survey.
              </p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">3</div>
              <h3 className="text-xl font-semibold mb-2">Access API</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Get instant access to the API you need.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
