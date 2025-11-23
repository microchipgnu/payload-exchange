export interface Resource {
  accepts: AcceptsCriteria[];
  lastUpdated: string;
  metadata: ResourceMetadata;
  resource: string;
  type: string;
  x402Version: number;
  id?: string;
  url?: string;
}

export interface AcceptsCriteria {
  asset: string;
  description: string;
  extra?: {
    name?: string;
    version?: string;
    decimals?: number;
    symbol?: string;
  };
  maxAmountRequired: string;
  maxTimeoutSeconds: number;
  mimeType: string;
  network: string;
  outputSchema: OutputSchema;
  payTo: string;
  resource: string;
  scheme: string;
}

export interface OutputSchema {
  input: {
    discoverable?: boolean;
    method: string;
    type: string;
    displayName?: string;
    name?: string;
    bodyFields?: Record<string, any>;
    headerFields?: Record<string, any>;
    queryParams?: Record<string, any>;
    properties?: Record<string, any>;
    bodyType?: string;
  };
  output?: any; // Using any for flexibility as output structure varies greatly
}

export interface ResourceMetadata {
  confidence: ConfidenceScore;
  errorAnalysis: ErrorAnalysis;
  paymentAnalytics: PaymentAnalytics;
  performance: PerformanceMetrics;
  reliability: ReliabilityMetrics;
}

export interface ConfidenceScore {
  overallScore: number;
  performanceScore: number;
  recencyScore: number;
  reliabilityScore: number;
  volumeScore: number;
}

export interface ErrorAnalysis {
  abandonedFlows: number;
  apiErrors: number;
  delayedSettlements: number;
  facilitatorErrors: number;
  requestErrors: number;
}

export interface PaymentAnalytics {
  averageDailyTransactions: number;
  totalTransactions: number;
  totalUniqueUsers: number;
  transactions24h: number;
  transactionsMonth: number;
  transactionsWeek: number;
  [key: string]: number; // Allow dynamic keys like "base:0x..."
}

export interface PerformanceMetrics {
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  recentAvgLatencyMs: number;
}

export interface ReliabilityMetrics {
  apiSuccessRate: number;
  successfulSettlements: number;
  totalRequests: number;
}
