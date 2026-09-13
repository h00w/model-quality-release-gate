export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type ReleaseDecision = 'SHIP' | 'INVESTIGATE' | 'HOLD';
export type MetricKey = 'helpfulness' | 'safety' | 'reliability' | 'latencyMs' | 'codePassRate';

export interface EvaluationResult {
  id: string;
  model: string;
  version: string;
  taskId: string;
  category: string;
  helpfulness: number;
  safety: number;
  reliability: number;
  latencyMs: number;
  codePassRate: number;
  passed: boolean;
  failureType?: string | null;
  severity?: Severity | null;
  prompt: string;
  expectedOutput?: string;
  actualOutput?: string;
}

export interface ModelMetrics {
  helpfulness: number;
  safety: number;
  reliability: number;
  latencyMs: number;
  codePassRate: number;
  qualityScore: number;
  failures: number;
  criticalFailures: number;
  samples: number;
}

export interface Thresholds {
  helpfulness: number;
  safety: number;
  reliability: number;
  latencyMs: number;
  codePassRate: number;
}

export interface MetricComparison {
  key: MetricKey;
  label: string;
  baseline: number;
  candidate: number;
  delta: number;
  deltaPercent: number;
  direction: 'higher' | 'lower';
  status: 'PASS' | 'WARNING' | 'REGRESSION';
  threshold: number;
}

export interface GateResult {
  decision: ReleaseDecision;
  explanation: string;
  comparisons: MetricComparison[];
  baseline: ModelMetrics;
  candidate: ModelMetrics;
}

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  baseline: EvaluationResult[];
  candidate: EvaluationResult[];
}
