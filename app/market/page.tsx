"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Resource {
  resource: string;
  accepts?: Array<{
    maxAmountRequired?: string;
    network?: string;
    description?: string;
  }>;
  metadata?: {
    paymentAnalytics?: {
      totalTransactions?: number;
      totalUniqueUsers?: number;
      averageDailyTransactions?: number;
      transactionsMonth?: number;
    };
    confidence?: {
      overallScore?: number;
    };
    description?: string;
    outputSchema?: {
      input?: {
        method?: string;
        headerFields?: Record<string, any>;
        bodyFields?: Record<string, any>;
      };
    };
  };
}

interface PaymentAnalytics {
  totalTransactions?: number;
  totalUniqueUsers?: number;
  averageDailyTransactions?: number;
  transactionsMonth?: number;
}

interface Opportunity {
  resource: string;
  description: string;
  maxAmountRequired: number;
  totalTransactions: number;
  totalUniqueUsers: number;
  averageDailyTransactions: number;
  transactionsMonth: number;
  potentialReach: number;
  theoreticalReach: number;
  marketQuality: number;
  recommendedAllocation: number;
  confidenceScore: number;
  network: string;
}

export default function MarketPage() {
  const [resourcesData, setResourcesData] = useState<Resource[]>([]);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [budget, setBudget] = useState(100);
  const [sortBy, setSortBy] = useState("reach");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [currentOpportunities, setCurrentOpportunities] = useState<
    Opportunity[]
  >([]);
  const [filteredOpportunities, setFilteredOpportunities] = useState<
    Opportunity[]
  >([]);
  const [currentView, setCurrentView] = useState<"table" | "grid" | "chart">(
    "table",
  );
  const [currentFilters, setCurrentFilters] = useState<string[]>(["all"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusText, setStatusText] = useState("Loading resources...");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [currentTestResource, setCurrentTestResource] =
    useState<Resource | null>(null);
  const [testMethod, setTestMethod] = useState("GET");
  const [testHeaders, setTestHeaders] = useState("{}");
  const [testBody, setTestBody] = useState("{}");
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testResponseStatus, setTestResponseStatus] = useState<string>("");
  const [testResponseTime, setTestResponseTime] = useState<string>("");

  const distributionChartRef = useRef<HTMLCanvasElement>(null);
  const scatterChartRef = useRef<HTMLCanvasElement>(null);

  // Load resources data
  const loadResources = useCallback(async () => {
    setStatusText("Loading resources...");
    try {
      const response = await fetch("/resources.json");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setResourcesData(data);
      setResourcesLoaded(true);
      setStatusText(`Loaded ${data.length.toLocaleString()} resources`);
    } catch (error: any) {
      console.error("Error loading resources:", error);
      setResourcesLoaded(false);
      setStatusText(`Error: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // Convert smallest unit to USD (assuming USDC with 6 decimals)
  const toUSD = (amount: string) => Number.parseInt(amount) / 1_000_000;

  // Calculate market quality score (0-1)
  const calculateMarketQualityScore = (
    analytics: PaymentAnalytics | undefined,
    confidenceScore: number,
  ): number => {
    const weights = {
      transactionVolume: 0.3,
      userBase: 0.25,
      recentActivity: 0.25,
      confidence: 0.2,
    };

    const transactionScore = Math.min(
      1,
      Math.log10((analytics?.totalTransactions || 0) + 1) / 4,
    );
    const userScore = Math.min(1, (analytics?.totalUniqueUsers || 0) / 100);
    const activityScore = Math.min(1, (analytics?.transactionsMonth || 0) / 50);
    const confScore = confidenceScore || 0;

    return (
      transactionScore * weights.transactionVolume +
      userScore * weights.userBase +
      activityScore * weights.recentActivity +
      confScore * weights.confidence
    );
  };

  // Calculate realistic potential reach
  const calculateRealisticReach = (
    budget: number,
    costPerTx: number,
    analytics: PaymentAnalytics | undefined,
    marketQuality: number,
  ): number => {
    const theoreticalMax = Math.floor(budget / costPerTx);

    if (
      (analytics?.totalTransactions || 0) === 0 &&
      (analytics?.totalUniqueUsers || 0) === 0
    ) {
      return Math.min(theoreticalMax, 10);
    }

    const monthlyActivity =
      analytics?.transactionsMonth ||
      (analytics?.averageDailyTransactions || 0) * 30;
    const activityBasedReach = Math.floor(monthlyActivity * 3);
    const qualityMultiplier = 0.3 + marketQuality * 0.7;

    const realisticReach = Math.min(
      theoreticalMax,
      Math.floor(activityBasedReach * qualityMultiplier),
    );

    return Math.max(realisticReach, theoreticalMax > 0 ? 1 : 0);
  };

  // Calculate recommended budget allocation
  const calculateRecommendedAllocation = (
    budget: number,
    costPerTx: number,
    analytics: PaymentAnalytics | undefined,
    marketQuality: number,
  ): number => {
    const monthlyActivity =
      analytics?.transactionsMonth ||
      (analytics?.averageDailyTransactions || 0) * 30;
    const monthsToCover = 1 + marketQuality * 2;
    const recommendedTx = Math.floor(monthlyActivity * monthsToCover);
    const recommendedBudget = recommendedTx * costPerTx;

    return Math.min(recommendedBudget, budget);
  };

  // Analyze market potential
  const analyzeMarket = useCallback(
    (budget: number, networkFilter: string): Opportunity[] => {
      const opportunities: Opportunity[] = [];
      const MIN_COST_THRESHOLD = 0.000_01;

      resourcesData.forEach((resource) => {
        if (
          !(
            resource?.metadata?.paymentAnalytics &&
            resource.accepts &&
            Array.isArray(resource.accepts)
          )
        ) {
          return;
        }

        resource.accepts.forEach((accept) => {
          if (!accept?.maxAmountRequired) return;

          if (networkFilter !== "all" && accept.network !== networkFilter) {
            return;
          }

          try {
            const maxAmount = toUSD(accept.maxAmountRequired);

            if (maxAmount < MIN_COST_THRESHOLD) return;

            if (budget >= maxAmount && maxAmount > 0) {
              const analytics = resource?.metadata?.paymentAnalytics;
              const confidenceScore =
                resource?.metadata?.confidence?.overallScore || 0;

              const marketQuality = calculateMarketQualityScore(
                analytics,
                confidenceScore,
              );
              const realisticReach = calculateRealisticReach(
                budget,
                maxAmount,
                analytics,
                marketQuality,
              );
              const recommendedAllocation = calculateRecommendedAllocation(
                budget,
                maxAmount,
                analytics,
                marketQuality,
              );

              opportunities.push({
                resource: resource.resource || "Unknown",
                description:
                  accept.description || resource.metadata?.description || "",
                maxAmountRequired: maxAmount,
                totalTransactions: analytics?.totalTransactions || 0,
                totalUniqueUsers: analytics?.totalUniqueUsers || 0,
                averageDailyTransactions:
                  analytics?.averageDailyTransactions || 0,
                transactionsMonth: analytics?.transactionsMonth || 0,
                potentialReach: realisticReach,
                theoreticalReach: Math.floor(budget / maxAmount),
                marketQuality,
                recommendedAllocation,
                confidenceScore,
                network: accept.network || "unknown",
              });
            }
          } catch (error) {
            console.error("Error processing resource:", error);
          }
        });
      });

      return opportunities;
    },
    [resourcesData],
  );

  // Sort opportunities
  const sortOpportunities = useCallback(
    (opportunities: Opportunity[], sortBy: string): Opportunity[] => {
      const sorted = [...opportunities];

      switch (sortBy) {
        case "reach":
          sorted.sort((a, b) => {
            if (b.potentialReach !== a.potentialReach) {
              return b.potentialReach - a.potentialReach;
            }
            return b.marketQuality - a.marketQuality;
          });
          break;
        case "cost":
          sorted.sort((a, b) => a.maxAmountRequired - b.maxAmountRequired);
          break;
        case "transactions":
          sorted.sort((a, b) => b.totalTransactions - a.totalTransactions);
          break;
        case "users":
          sorted.sort((a, b) => b.totalUniqueUsers - a.totalUniqueUsers);
          break;
        case "confidence":
          sorted.sort((a, b) => b.confidenceScore - a.confidenceScore);
          break;
        case "quality":
          sorted.sort((a, b) => b.marketQuality - a.marketQuality);
          break;
      }

      return sorted;
    },
    [],
  );

  // Estimate unique users accounting for overlap
  const estimateUniqueUsers = useCallback(
    (opportunities: Opportunity[]): number => {
      if (opportunities.length === 0) return 0;
      if (opportunities.length === 1) return opportunities[0].totalUniqueUsers;

      const networkGroups: Record<string, Opportunity[]> = {};
      opportunities.forEach((opp) => {
        if (!networkGroups[opp.network]) {
          networkGroups[opp.network] = [];
        }
        networkGroups[opp.network].push(opp);
      });

      let estimatedUniqueUsers = 0;

      Object.keys(networkGroups).forEach((network) => {
        const group = networkGroups[network];

        if (group.length === 1) {
          estimatedUniqueUsers += group[0].totalUniqueUsers;
          return;
        }

        const sorted = [...group].sort(
          (a, b) => b.totalUniqueUsers - a.totalUniqueUsers,
        );

        let uniqueUsers = sorted[0].totalUniqueUsers;

        for (let i = 1; i < sorted.length; i++) {
          const current = sorted[i];
          const previous = sorted[i - 1];

          const transactionRatio = Math.min(
            current.totalTransactions / (previous.totalTransactions + 1),
            previous.totalTransactions / (current.totalTransactions + 1),
          );

          const userBaseRatio = Math.min(
            current.totalUniqueUsers / (previous.totalUniqueUsers + 1),
            previous.totalUniqueUsers / (current.totalUniqueUsers + 1),
          );

          const overlapFactor =
            transactionRatio * 0.4 +
            userBaseRatio * 0.3 +
            Math.min(current.marketQuality, previous.marketQuality) * 0.3;

          const estimatedOverlap =
            current.totalUniqueUsers * overlapFactor * 0.3;
          const newUniqueUsers = Math.max(
            0,
            current.totalUniqueUsers - estimatedOverlap,
          );

          uniqueUsers += newUniqueUsers;
        }

        estimatedUniqueUsers += uniqueUsers;
      });

      const networkCount = Object.keys(networkGroups).length;
      if (networkCount > 1) {
        const crossNetworkOverlapFactor = Math.min(
          0.15,
          0.05 + (networkCount - 2) * 0.02,
        );
        estimatedUniqueUsers =
          estimatedUniqueUsers * (1 - crossNetworkOverlapFactor);
      }

      return Math.round(estimatedUniqueUsers);
    },
    [],
  );

  // Calculate metrics
  const calculateMetrics = useCallback(
    (budget: number, opportunities: Opportunity[]) => {
      const totalReach = opportunities.reduce(
        (sum, opp) => sum + opp.potentialReach,
        0,
      );
      const estimatedUniqueUsers = estimateUniqueUsers(opportunities);
      const naiveTotalUsers = opportunities.reduce(
        (sum, opp) => sum + opp.totalUniqueUsers,
        0,
      );
      const reachPerUser =
        estimatedUniqueUsers > 0
          ? (totalReach / estimatedUniqueUsers).toFixed(1)
          : "0";

      return {
        totalReach,
        estimatedUniqueUsers,
        naiveTotalUsers,
        reachPerUser,
        totalResources: opportunities.length,
      };
    },
    [estimateUniqueUsers],
  );

  // Handle form submission
  const handleAnalyze = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (isNaN(budget) || budget <= 0) {
        return;
      }

      if (!(resourcesLoaded && resourcesData) || resourcesData.length === 0) {
        return;
      }

      setIsAnalyzing(true);

      setTimeout(() => {
        try {
          const opportunities = analyzeMarket(budget, networkFilter);
          const sorted = sortOpportunities(opportunities, sortBy);
          setCurrentOpportunities(sorted);
          setFilteredOpportunities(sorted);
        } catch (error) {
          console.error("Error analyzing market:", error);
        } finally {
          setIsAnalyzing(false);
        }
      }, 300);
    },
    [
      budget,
      networkFilter,
      sortBy,
      resourcesLoaded,
      resourcesData,
      analyzeMarket,
      sortOpportunities,
    ],
  );

  // Apply filters and search
  useEffect(() => {
    let filtered = [...currentOpportunities];

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter((opp) =>
        opp.resource.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Apply filters
    if (!currentFilters.includes("all")) {
      filtered = filtered.filter((opp) => {
        if (currentFilters.includes("high-quality") && opp.marketQuality < 0.7)
          return false;
        if (currentFilters.includes("high-reach") && opp.potentialReach < 1000)
          return false;
        if (currentFilters.includes("low-cost") && opp.maxAmountRequired > 0.01)
          return false;
        if (currentFilters.includes("high-users") && opp.totalUniqueUsers < 10)
          return false;
        return true;
      });
    }

    setFilteredOpportunities(filtered);
  }, [currentOpportunities, searchQuery, currentFilters]);

  // Calculate metrics for display
  const metrics = calculateMetrics(budget, filteredOpportunities);

  // Budget preset handler
  const handleBudgetPreset = (presetBudget: number) => {
    setBudget(presetBudget);
  };

  // Filter chip handler
  const handleFilterClick = (filter: string) => {
    if (filter === "all") {
      setCurrentFilters(["all"]);
    } else {
      setCurrentFilters((prev) => {
        const newFilters = prev.filter((f) => f !== "all");
        if (newFilters.includes(filter)) {
          const filtered = newFilters.filter((f) => f !== filter);
          return filtered.length === 0 ? ["all"] : filtered;
        }
        return [...newFilters, filter];
      });
    }
  };

  // Open test modal
  const openTestModal = (resourceUrl: string) => {
    const fullResource = resourcesData.find((r) => r.resource === resourceUrl);
    if (!fullResource) {
      alert("Resource data not found");
      return;
    }

    setCurrentTestResource(fullResource);
    const method = fullResource.metadata?.outputSchema?.input?.method || "GET";
    setTestMethod(method);

    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (fullResource.metadata?.outputSchema?.input?.headerFields) {
      Object.keys(
        fullResource.metadata.outputSchema.input.headerFields,
      ).forEach((key) => {
        if (key !== "X-PAYMENT") {
          defaultHeaders[key] = "";
        }
      });
    }

    setTestHeaders(JSON.stringify(defaultHeaders, null, 2));

    if (method === "POST" || method === "PUT") {
      const bodyFields = fullResource.metadata?.outputSchema?.input?.bodyFields;
      if (bodyFields) {
        const defaultBody: Record<string, any> = {};
        Object.keys(bodyFields).forEach((key) => {
          defaultBody[key] = bodyFields[key].default || "";
        });
        setTestBody(JSON.stringify(defaultBody, null, 2));
      } else {
        setTestBody("{}");
      }
    } else {
      setTestBody("{}");
    }

    setTestResponse(null);
    setTestResponseStatus("");
    setTestResponseTime("");
    setTestModalOpen(true);
  };

  // Execute test
  const executeTest = async () => {
    if (!currentTestResource) return;

    const url = currentTestResource.resource;
    let headers: Record<string, string> = {};
    let body: any = null;

    try {
      headers = JSON.parse(testHeaders || "{}");
    } catch (e) {
      alert("Invalid headers JSON");
      return;
    }

    if (testBody && (testMethod === "POST" || testMethod === "PUT")) {
      try {
        body = JSON.parse(testBody);
      } catch (e) {
        alert("Invalid body JSON");
        return;
      }
    }

    const startTime = Date.now();
    try {
      const options: RequestInit = {
        method: testMethod,
        headers,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      let responseText: string;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const json = await response.json();
        responseText = JSON.stringify(json, null, 2);
      } else {
        responseText = await response.text();
      }

      setTestResponseStatus(`${response.status} ${response.statusText}`);
      setTestResponseTime(`${responseTime}ms`);
      setTestResponse(responseText);
    } catch (error: any) {
      setTestResponseStatus(`Error: ${error.message}`);
      setTestResponseTime("");
      setTestResponse(error.stack || error.message);
    }
  };

  // Draw charts
  useEffect(() => {
    if (currentView !== "chart" || filteredOpportunities.length === 0) return;

    // Distribution chart
    if (distributionChartRef.current) {
      const canvas = distributionChartRef.current;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 300;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const padding = 40;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;

      ctx.clearRect(0, 0, width, height);

      const networkData: Record<string, number> = {};
      filteredOpportunities.forEach((opp) => {
        networkData[opp.network] = (networkData[opp.network] || 0) + 1;
      });

      const entries = Object.entries(networkData);
      const maxValue = Math.max(...Object.values(networkData));
      const barWidth = chartWidth / entries.length;
      const colors = ["#1877f2", "#42b72a", "#f39c12", "#e74c3c", "#9b59b6"];

      entries.forEach(([network, count], index) => {
        const barHeight = (count / maxValue) * chartHeight;
        const x = padding + index * barWidth + barWidth * 0.1;
        const y = height - padding - barHeight;

        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(x, y, barWidth * 0.8, barHeight);

        ctx.fillStyle = "#1c1e21";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(network, x + barWidth * 0.4, height - padding + 20);
        ctx.fillText(count.toString(), x + barWidth * 0.4, y - 5);
      });
    }

    // Scatter chart
    if (scatterChartRef.current) {
      const canvas = scatterChartRef.current;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 300;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const padding = 60;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;

      ctx.clearRect(0, 0, width, height);

      const maxCost = Math.max(
        ...filteredOpportunities.map((o) => o.maxAmountRequired),
      );
      const maxReach = Math.max(
        ...filteredOpportunities.map((o) => o.potentialReach),
      );

      ctx.strokeStyle = "#dadde1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.stroke();

      filteredOpportunities.slice(0, 100).forEach((opp) => {
        const x = padding + (opp.maxAmountRequired / maxCost) * chartWidth;
        const y =
          height - padding - (opp.potentialReach / maxReach) * chartHeight;

        ctx.fillStyle = `rgba(24, 119, 242, ${0.3 + opp.marketQuality * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#65676b";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Cost per Transaction", width / 2, height - 10);

      ctx.save();
      ctx.translate(15, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Potential Reach", 0, 0);
      ctx.restore();
    }
  }, [currentView, filteredOpportunities]);

  const opportunityData = currentTestResource
    ? filteredOpportunities.find(
        (opp) => opp.resource === currentTestResource.resource,
      )
    : null;
  const accept = currentTestResource?.accepts?.[0];

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans text-[#1c1e21]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-[#dadde1] border-b bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center px-4">
          <h1 className="font-semibold text-[#1c1e21] text-xl">
            Resource Monetization Platform
          </h1>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-[1600px] gap-0 bg-[#f0f2f5]">
        {/* Sidebar */}
        <aside className="h-fit w-80 flex-shrink-0 border-[#dadde1] border-r bg-white p-4">
          <Card>
            <CardHeader>
              <CardTitle className="border-[#dadde1] border-b pb-3 font-semibold text-base">
                Campaign Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleAnalyze}>
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget Amount</Label>
                  <div className="flex items-center gap-3">
                    <Slider
                      className="flex-1"
                      max={10_000}
                      min={1}
                      onValueChange={(value) => setBudget(value[0])}
                      step={1}
                      value={[budget]}
                    />
                    <Input
                      className="w-24"
                      id="budget"
                      min={0}
                      onChange={(e) =>
                        setBudget(Number.parseFloat(e.target.value) || 0)
                      }
                      required
                      step={0.01}
                      type="number"
                      value={budget}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    ${budget.toFixed(2)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Quick Budget Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {[10, 50, 100, 500, 1000, 5000].map((preset) => (
                      <Button
                        className="h-8"
                        key={preset}
                        onClick={() => handleBudgetPreset(preset)}
                        size="sm"
                        type="button"
                        variant={budget === preset ? "default" : "outline"}
                      >
                        {preset >= 1000 ? `$${preset / 1000}K` : `$${preset}`}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sortBy">Sort By</Label>
                  <Select onValueChange={setSortBy} value={sortBy}>
                    <SelectTrigger id="sortBy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quality">Market Quality</SelectItem>
                      <SelectItem value="reach">Potential Reach</SelectItem>
                      <SelectItem value="cost">Cost per Transaction</SelectItem>
                      <SelectItem value="transactions">
                        Total Transactions
                      </SelectItem>
                      <SelectItem value="users">Unique Users</SelectItem>
                      <SelectItem value="confidence">
                        Confidence Score
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="networkFilter">Network</Label>
                  <Select
                    onValueChange={setNetworkFilter}
                    value={networkFilter}
                  >
                    <SelectTrigger id="networkFilter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Networks</SelectItem>
                      <SelectItem value="base">Base</SelectItem>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="polygon">Polygon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  disabled={isAnalyzing || !resourcesLoaded}
                  type="submit"
                >
                  {isAnalyzing ? "Analyzing..." : "Analyze Opportunities"}
                </Button>
              </form>

              <div className="mt-3 flex items-center gap-2 text-muted-foreground text-xs">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    resourcesLoaded ? "bg-green-500" : "bg-yellow-500",
                  )}
                />
                <span>{statusText}</span>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Content Area */}
        <main className="min-w-0 flex-1 p-4">
          {/* Metrics Dashboard */}
          {filteredOpportunities.length > 0 && (
            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card className="group relative cursor-pointer transition-colors hover:border-primary">
                <CardContent className="p-4">
                  <p className="mb-1 text-muted-foreground text-xs">
                    Total Budget
                  </p>
                  <p className="font-semibold text-3xl">${budget.toFixed(2)}</p>
                </CardContent>
                <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all group-hover:w-full" />
              </Card>
              <Card className="group relative cursor-pointer transition-colors hover:border-primary">
                <CardContent className="p-4">
                  <p className="mb-1 text-muted-foreground text-xs">
                    Potential Reach
                  </p>
                  <p className="font-semibold text-3xl">
                    {metrics.totalReach.toLocaleString()}
                  </p>
                  <p className="mt-1 text-green-600 text-xs">transactions</p>
                </CardContent>
                <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all group-hover:w-full" />
              </Card>
              <Card className="group relative cursor-pointer transition-colors hover:border-primary">
                <CardContent className="p-4">
                  <p className="mb-1 text-muted-foreground text-xs">
                    Resources Found
                  </p>
                  <p className="font-semibold text-3xl">
                    {metrics.totalResources.toLocaleString()}
                  </p>
                </CardContent>
                <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all group-hover:w-full" />
              </Card>
              <Card className="group relative cursor-pointer transition-colors hover:border-primary">
                <CardContent className="p-4">
                  <p className="mb-1 text-muted-foreground text-xs">
                    Estimated Unique Users
                  </p>
                  <p className="font-semibold text-3xl">
                    {metrics.estimatedUniqueUsers.toLocaleString()}
                  </p>
                  {metrics.estimatedUniqueUsers < metrics.naiveTotalUsers &&
                    metrics.naiveTotalUsers > 0 && (
                      <p className="mt-1 text-muted-foreground text-xs">
                        ~
                        {(
                          (1 -
                            metrics.estimatedUniqueUsers /
                              metrics.naiveTotalUsers) *
                          100
                        ).toFixed(0)}
                        % overlap accounted
                      </p>
                    )}
                </CardContent>
                <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all group-hover:w-full" />
              </Card>
              <Card className="group relative cursor-pointer transition-colors hover:border-primary">
                <CardContent className="p-4">
                  <p className="mb-1 text-muted-foreground text-xs">
                    Avg Reach per User
                  </p>
                  <p className="font-semibold text-3xl">
                    {metrics.reachPerUser}
                  </p>
                  <p className="mt-1 text-green-600 text-xs">transactions</p>
                </CardContent>
                <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all group-hover:w-full" />
              </Card>
            </div>
          )}

          {/* Results Section */}
          {filteredOpportunities.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex rounded-md bg-muted p-0.5">
                      <Button
                        className="h-8"
                        onClick={() => setCurrentView("table")}
                        size="sm"
                        type="button"
                        variant={currentView === "table" ? "default" : "ghost"}
                      >
                        📊 Table
                      </Button>
                      <Button
                        className="h-8"
                        onClick={() => setCurrentView("grid")}
                        size="sm"
                        type="button"
                        variant={currentView === "grid" ? "default" : "ghost"}
                      >
                        🎴 Cards
                      </Button>
                      <Button
                        className="h-8"
                        onClick={() => setCurrentView("chart")}
                        size="sm"
                        type="button"
                        variant={currentView === "chart" ? "default" : "ghost"}
                      >
                        📈 Charts
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 w-48"
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 Search resources..."
                      type="text"
                      value={searchQuery}
                    />
                    <span className="text-muted-foreground text-sm">
                      {filteredOpportunities.length.toLocaleString()} results
                    </span>
                  </div>
                </div>

                {/* Filters */}
                <div className="mt-4 rounded-md border bg-muted p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-muted-foreground text-xs">
                      Filters:
                    </span>
                    {[
                      "all",
                      "high-quality",
                      "high-reach",
                      "low-cost",
                      "high-users",
                    ].map((filter) => (
                      <Button
                        className="h-7 rounded-full"
                        key={filter}
                        onClick={() => handleFilterClick(filter)}
                        size="sm"
                        type="button"
                        variant={
                          currentFilters.includes(filter)
                            ? "default"
                            : "outline"
                        }
                      >
                        {filter === "all"
                          ? "All"
                          : filter === "high-quality"
                            ? "High Quality"
                            : filter === "high-reach"
                              ? "High Reach"
                              : filter === "low-cost"
                                ? "Low Cost"
                                : "High Users"}
                      </Button>
                    ))}
                    <Button
                      className="ml-auto h-7"
                      onClick={() => {
                        setCurrentFilters(["all"]);
                        setSearchQuery("");
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Chart View */}
                {currentView === "chart" && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Market Distribution by Network
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <canvas
                          className="h-[300px] w-full"
                          ref={distributionChartRef}
                        />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Reach vs Cost Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <canvas
                          className="h-[300px] w-full"
                          ref={scatterChartRef}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Table View */}
                {currentView === "table" && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Resource URL</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Cost/Transaction</TableHead>
                          <TableHead>Potential Reach</TableHead>
                          <TableHead>Market Quality</TableHead>
                          <TableHead>Total Transactions</TableHead>
                          <TableHead>Unique Users</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Network</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOpportunities.map((opp, idx) => {
                          const confidencePercent = (
                            opp.confidenceScore * 100
                          ).toFixed(0);
                          const qualityPercent = (
                            opp.marketQuality * 100
                          ).toFixed(0);

                          return (
                            <TableRow key={idx}>
                              <TableCell>
                                <a
                                  className="break-all font-medium text-primary hover:underline"
                                  href={opp.resource}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {opp.resource}
                                </a>
                              </TableCell>
                              <TableCell className="max-w-[300px] text-muted-foreground text-xs">
                                {opp.description || (
                                  <span className="text-muted-foreground italic">
                                    No description
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                ${opp.maxAmountRequired.toFixed(4)}
                              </TableCell>
                              <TableCell>
                                <strong>
                                  {opp.potentialReach.toLocaleString()}
                                </strong>
                                {opp.theoreticalReach > opp.potentialReach && (
                                  <div className="mt-0.5 text-muted-foreground text-xs">
                                    (theoretical:{" "}
                                    {opp.theoreticalReach.toLocaleString()})
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    opp.marketQuality >= 0.7
                                      ? "default"
                                      : opp.marketQuality >= 0.4
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {qualityPercent}%
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {opp.totalTransactions.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {opp.totalUniqueUsers.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    opp.confidenceScore >= 0.7
                                      ? "default"
                                      : opp.confidenceScore >= 0.4
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {confidencePercent}%
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{opp.network}</Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  onClick={() => openTestModal(opp.resource)}
                                  size="sm"
                                  variant="outline"
                                >
                                  Test
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Grid View */}
                {currentView === "grid" && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredOpportunities.map((opp, idx) => {
                      const confidencePercent = (
                        opp.confidenceScore * 100
                      ).toFixed(0);
                      const qualityPercent = (opp.marketQuality * 100).toFixed(
                        0,
                      );

                      return (
                        <Card
                          className="transition-colors hover:border-primary"
                          key={idx}
                        >
                          <CardHeader>
                            <CardTitle className="text-sm">
                              <a
                                className="break-all text-primary hover:underline"
                                href={opp.resource}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                {opp.resource}
                              </a>
                            </CardTitle>
                            {opp.description && (
                              <p className="mt-2 line-clamp-2 text-muted-foreground text-xs">
                                {opp.description}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge
                                variant={
                                  opp.marketQuality >= 0.7
                                    ? "default"
                                    : opp.marketQuality >= 0.4
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {qualityPercent}% Quality
                              </Badge>
                              <Badge
                                variant={
                                  opp.confidenceScore >= 0.7
                                    ? "default"
                                    : opp.confidenceScore >= 0.4
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {confidencePercent}% Confidence
                              </Badge>
                              <Badge variant="outline">{opp.network}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground text-xs">
                                  Cost per Transaction
                                </p>
                                <p className="font-semibold">
                                  ${opp.maxAmountRequired.toFixed(4)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">
                                  Potential Reach
                                </p>
                                <p className="font-semibold">
                                  {opp.potentialReach.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">
                                  Total Transactions
                                </p>
                                <p className="font-semibold">
                                  {opp.totalTransactions.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">
                                  Unique Users
                                </p>
                                <p className="font-semibold">
                                  {opp.totalUniqueUsers.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">
                                  Monthly Transactions
                                </p>
                                <p className="font-semibold">
                                  {opp.transactionsMonth.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">
                                  Daily Average
                                </p>
                                <p className="font-semibold">
                                  {opp.averageDailyTransactions.toFixed(2)}
                                </p>
                              </div>
                              <div className="col-span-2">
                                <p className="mb-1 text-muted-foreground text-xs">
                                  Market Quality
                                </p>
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full bg-primary transition-all"
                                      style={{
                                        width: `${opp.marketQuality * 100}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="font-semibold text-xs">
                                    {(opp.marketQuality * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">
                                  Recommended Spend
                                </p>
                                <p className="font-semibold">
                                  ${opp.recommendedAllocation.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 border-t pt-4">
                              <Button
                                className="w-full"
                                onClick={() => openTestModal(opp.resource)}
                                size="sm"
                                variant="outline"
                              >
                                Test Resource
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {filteredOpportunities.length === 0 &&
            currentOpportunities.length === 0 && (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="mb-4 text-5xl">📊</div>
                  <h3 className="mb-2 font-semibold text-lg">No results yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Enter your budget and click "Analyze Opportunities" to see
                    market potential
                  </p>
                </CardContent>
              </Card>
            )}
        </main>
      </div>

      {/* Test Modal */}
      <Dialog onOpenChange={setTestModalOpen} open={testModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle>Test Resource</DialogTitle>
          </DialogHeader>
          {currentTestResource && (
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-2 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resource:</span>
                    <span className="font-medium">
                      {currentTestResource.resource}
                    </span>
                  </div>
                  {opportunityData?.description && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Description:
                      </span>
                      <span className="font-medium">
                        {opportunityData.description}
                      </span>
                    </div>
                  )}
                  {opportunityData && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Cost per Transaction:
                      </span>
                      <span className="font-medium">
                        ${opportunityData.maxAmountRequired.toFixed(4)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network:</span>
                    <span className="font-medium">
                      {accept?.network || "unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method:</span>
                    <span className="font-medium">
                      {currentTestResource.metadata?.outputSchema?.input
                        ?.method || "GET"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Tabs className="w-full" defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent className="space-y-4" value="request">
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select onValueChange={setTestMethod} value={testMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <code className="block break-all rounded-md bg-muted p-3 font-mono text-xs">
                      {currentTestResource.resource}
                    </code>
                  </div>
                  <div className="space-y-2">
                    <Label>Headers</Label>
                    <Textarea
                      className="font-mono text-xs"
                      onChange={(e) => setTestHeaders(e.target.value)}
                      placeholder='{"Content-Type": "application/json"}'
                      value={testHeaders}
                    />
                    <p className="text-muted-foreground text-xs">
                      JSON format for headers
                    </p>
                  </div>
                  {(testMethod === "POST" || testMethod === "PUT") && (
                    <div className="space-y-2">
                      <Label>Request Body</Label>
                      <Textarea
                        className="font-mono text-xs"
                        onChange={(e) => setTestBody(e.target.value)}
                        placeholder='{"key": "value"}'
                        value={testBody}
                      />
                      <p className="text-muted-foreground text-xs">
                        JSON format for request body (for POST/PUT)
                      </p>
                    </div>
                  )}
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
                    <p className="text-xs text-yellow-800">
                      <strong>Note:</strong> Some APIs may block requests due to
                      CORS policy. If you encounter CORS errors, the API may
                      require server-side requests or specific headers.
                    </p>
                  </div>
                  <Button className="w-full" onClick={executeTest}>
                    Execute Test
                  </Button>
                </TabsContent>
                <TabsContent value="response">
                  {testResponse ? (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              testResponseStatus.startsWith("2")
                                ? "default"
                                : "destructive"
                            }
                          >
                            {testResponseStatus}
                          </Badge>
                          {testResponseTime && (
                            <span className="text-muted-foreground text-xs">
                              {testResponseTime}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
                          {typeof testResponse === "string"
                            ? testResponse
                            : JSON.stringify(testResponse, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="py-10 text-center text-muted-foreground">
                      No response yet. Execute a test request first.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
