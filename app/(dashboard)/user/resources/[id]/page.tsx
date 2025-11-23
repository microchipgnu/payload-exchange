import { readFile } from "fs/promises";
import { notFound } from "next/navigation";
import { join } from "path";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ResourceDetailClient from "./resource-detail-client";

interface ResourceItem {
  resource: string;
  type: string;
  lastUpdated: string;
  accepts: Array<{
    resource: string;
    description?: string;
    asset?: string;
    network?: string;
    maxAmountRequired?: string;
    payTo?: string;
    [key: string]: unknown;
  }>;
  metadata?: {
    confidence?: {
      overallScore?: number;
      performanceScore?: number;
      recencyScore?: number;
      reliabilityScore?: number;
      volumeScore?: number;
    };
    paymentAnalytics?: {
      totalTransactions?: number;
      totalUniqueUsers?: number;
      averageDailyTransactions?: number;
      [key: string]: unknown;
    };
    performance?: {
      avgLatencyMs?: number;
      maxLatencyMs?: number;
      minLatencyMs?: number;
    };
    reliability?: {
      apiSuccessRate?: number;
      successfulSettlements?: number;
      totalRequests?: number;
    };
    [key: string]: unknown;
  };
  x402Version?: number;
}

async function getResource(id: string): Promise<ResourceItem | null> {
  try {
    const filePath = join(process.cwd(), "public", "resources.json");
    const fileContents = await readFile(filePath, "utf-8");
    const resources: ResourceItem[] = JSON.parse(fileContents);

    // ID format from search page: `${item.resource}-${index}`
    // Try to find by exact ID match first, then by resource URL
    const resource = resources.find((r, index) => {
      const expectedId = `${r.resource}-${index}`;
      return expectedId === id || r.resource === id;
    });

    return resource || null;
  } catch (error) {
    console.error("Failed to load resource:", error);
    return null;
  }
}

export default async function ResourceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const resource = await getResource(params.id);

  if (!resource) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Resource Details</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="break-all">{resource.resource}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Type
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                {resource.type}
              </p>
            </div>

            {resource.metadata?.confidence && (
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confidence Score
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  {(resource.metadata.confidence.overallScore || 0).toFixed(2)}
                </p>
              </div>
            )}

            {resource.metadata?.paymentAnalytics && (
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Analytics
                </p>
                <div className="text-slate-600 dark:text-slate-400 text-sm space-y-1">
                  <p>
                    Total Transactions:{" "}
                    {resource.metadata.paymentAnalytics.totalTransactions || 0}
                  </p>
                  <p>
                    Unique Users:{" "}
                    {resource.metadata.paymentAnalytics.totalUniqueUsers || 0}
                  </p>
                  {resource.metadata.paymentAnalytics
                    .averageDailyTransactions && (
                    <p>
                      Avg Daily Transactions:{" "}
                      {resource.metadata.paymentAnalytics.averageDailyTransactions.toFixed(
                        2,
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {resource.metadata?.performance && (
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Performance
                </p>
                <div className="text-slate-600 dark:text-slate-400 text-sm space-y-1">
                  <p>
                    Avg Latency: {resource.metadata.performance.avgLatencyMs}ms
                  </p>
                  <p>
                    Min Latency: {resource.metadata.performance.minLatencyMs}ms
                  </p>
                  <p>
                    Max Latency: {resource.metadata.performance.maxLatencyMs}ms
                  </p>
                </div>
              </div>
            )}

            {resource.metadata?.reliability && (
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reliability
                </p>
                <div className="text-slate-600 dark:text-slate-400 text-sm space-y-1">
                  <p>
                    API Success Rate:{" "}
                    {(
                      (resource.metadata.reliability.apiSuccessRate || 0) * 100
                    ).toFixed(1)}
                    %
                  </p>
                  <p>
                    Successful Settlements:{" "}
                    {resource.metadata.reliability.successfulSettlements || 0}
                  </p>
                  <p>
                    Total Requests:{" "}
                    {resource.metadata.reliability.totalRequests || 0}
                  </p>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Last Updated
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                {new Date(resource.lastUpdated).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {resource.accepts && resource.accepts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {resource.accepts.map((accept, index) => (
                <div
                  key={`${accept.asset || ""}-${accept.network || ""}-${accept.payTo || ""}-${index}`}
                  className="border rounded-lg p-4 space-y-2"
                >
                  {accept.network && (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Network
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        {accept.network}
                      </p>
                    </div>
                  )}
                  {accept.asset && (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Asset
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {accept.asset}
                      </p>
                    </div>
                  )}
                  {accept.maxAmountRequired && (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Max Amount Required
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        {(
                          BigInt(accept.maxAmountRequired) / BigInt(1_000_000)
                        ).toString()}{" "}
                        USDC
                      </p>
                    </div>
                  )}
                  {accept.payTo && (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Pay To
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 font-mono text-xs break-all">
                        {accept.payTo}
                      </p>
                    </div>
                  )}
                  {accept.description && (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Description
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        {accept.description}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <ResourceDetailClient
          resourceId={params.id}
          resourceUrl={resource.resource}
        />
      </div>
    </div>
  );
}
