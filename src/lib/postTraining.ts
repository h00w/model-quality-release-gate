export type Direction = 'higher' | 'lower';
export type ExperimentDecision = 'SHIP' | 'INVESTIGATE' | 'HOLD';

export interface ExperimentMetric {
  key: string;
  label: string;
  baseline: number;
  candidate: number;
  unit: '%' | 'ms' | 'usd' | 'tokens';
  direction: Direction;
  investigateThreshold: number;
  holdThreshold?: number;
  group: 'Quality' | 'Reliability' | 'Safety' | 'Performance' | 'Efficiency';
}

export interface PostTrainingExperiment {
  id: string;
  baseline: string;
  candidate: string;
  intervention: 'SFT' | 'Preference optimization' | 'RFT / RLVR' | 'Other';
  dataset: string;
  datasetSize: number;
  evaluationSet: string;
  note: string;
  metrics: ExperimentMetric[];
}

export interface MetricAssessment extends ExperimentMetric {
  delta: number;
  deltaPercent: number;
  status: 'IMPROVED' | 'STABLE' | 'REGRESSION' | 'CRITICAL';
}

export interface ExperimentHypothesis {
  id: string;
  label: string;
  strength: number;
  rationale: string;
}

export const illustrativeExperiment: PostTrainingExperiment = {
  id: 'exp-sft-001',
  baseline: 'CodeModel-v1',
  candidate: 'CodeModel-v2-sft',
  intervention: 'SFT',
  dataset: 'Curated coding instruction corpus',
  datasetSize: 10000,
  evaluationSet: 'Frozen coding + safety regression suite',
  note: 'Illustrative experiment used to demonstrate post-training investigation workflow; values are not claims about a deployed foundation model.',
  metrics: [
    { key:'codePass', label:'Code execution pass rate', baseline:71.4, candidate:76.9, unit:'%', direction:'higher', investigateThreshold:2, holdThreshold:8, group:'Quality' },
    { key:'unitTests', label:'Unit-test pass rate', baseline:68.2, candidate:74.6, unit:'%', direction:'higher', investigateThreshold:2, holdThreshold:8, group:'Quality' },
    { key:'sweBench', label:'SWE-bench-style success', baseline:31.7, candidate:36.4, unit:'%', direction:'higher', investigateThreshold:2, holdThreshold:8, group:'Quality' },
    { key:'instruction', label:'Instruction following', baseline:88.0, candidate:91.2, unit:'%', direction:'higher', investigateThreshold:2, holdThreshold:6, group:'Quality' },
    { key:'hallucination', label:'Hallucination rate', baseline:7.8, candidate:6.1, unit:'%', direction:'lower', investigateThreshold:1, holdThreshold:3, group:'Reliability' },
    { key:'safety', label:'Safety', baseline:96.1, candidate:94.8, unit:'%', direction:'higher', investigateThreshold:1, holdThreshold:3, group:'Safety' },
    { key:'latencyP95', label:'Latency P95', baseline:2800, candidate:3100, unit:'ms', direction:'lower', investigateThreshold:8, holdThreshold:25, group:'Performance' },
    { key:'cost', label:'Cost / request', baseline:0.031, candidate:0.035, unit:'usd', direction:'lower', investigateThreshold:10, holdThreshold:30, group:'Efficiency' },
    { key:'tokenEfficiency', label:'Output tokens / solved task', baseline:812, candidate:861, unit:'tokens', direction:'lower', investigateThreshold:5, holdThreshold:20, group:'Efficiency' },
  ],
};

function adverseDelta(metric: ExperimentMetric) {
  const raw = metric.candidate - metric.baseline;
  return metric.direction === 'higher' ? -raw : raw;
}

export function assessExperiment(experiment: PostTrainingExperiment) {
  const metrics: MetricAssessment[] = experiment.metrics.map(metric => {
    const delta = metric.candidate - metric.baseline;
    const deltaPercent = metric.baseline === 0 ? 0 : delta / metric.baseline * 100;
    const adverse = adverseDelta(metric);
    const thresholdValue = metric.unit === '%' ? adverse : Math.max(0, metric.direction === 'lower' ? deltaPercent : -deltaPercent);
    let status: MetricAssessment['status'] = 'STABLE';
    if (metric.holdThreshold !== undefined && thresholdValue > metric.holdThreshold) status = 'CRITICAL';
    else if (thresholdValue > metric.investigateThreshold) status = 'REGRESSION';
    else if ((metric.direction === 'higher' && delta > 0) || (metric.direction === 'lower' && delta < 0)) status = 'IMPROVED';
    return {...metric, delta, deltaPercent, status};
  });

  const critical = metrics.filter(m => m.status === 'CRITICAL');
  const regressions = metrics.filter(m => m.status === 'REGRESSION');
  const improvements = metrics.filter(m => m.status === 'IMPROVED');
  const decision: ExperimentDecision = critical.length ? 'HOLD' : regressions.length ? 'INVESTIGATE' : 'SHIP';
  const explanation = decision === 'HOLD'
    ? `A material regression crossed a hard release threshold (${critical.map(x=>x.label).join(', ')}).`
    : decision === 'INVESTIGATE'
      ? `${improvements.length} metric(s) improved, but ${regressions.map(x=>x.label).join(', ')} regressed beyond investigation thresholds.`
      : `No configured release constraint regressed beyond policy tolerance; ${improvements.length} metric(s) improved.`;
  return {metrics, decision, explanation, regressions, improvements, critical};
}

export function investigationHypotheses(result: ReturnType<typeof assessExperiment>): ExperimentHypothesis[] {
  const safetyRegressed = result.metrics.some(x => x.key === 'safety' && ['REGRESSION','CRITICAL'].includes(x.status));
  const latencyRegressed = result.metrics.some(x => x.key === 'latencyP95' && ['REGRESSION','CRITICAL'].includes(x.status));
  const costRegressed = result.metrics.some(x => x.key === 'cost' && ['REGRESSION','CRITICAL'].includes(x.status));
  return [
    { id:'distribution', label:'Training-data distribution shift', strength:safetyRegressed?88:62, rationale:'The SFT corpus may overweight solution completion patterns relative to secure and defensive coding behavior.' },
    { id:'contamination', label:'Instruction-data contamination / conflicting supervision', strength:safetyRegressed?73:48, rationale:'Unsafe or conflicting examples can move behavior even when aggregate code quality improves.' },
    { id:'objective', label:'Training-objective overspecialization', strength:64, rationale:'Optimizing completion quality can improve task success while weakening conservative behavior on edge cases.' },
    { id:'trajectory', label:'Longer generated trajectories', strength:latencyRegressed||costRegressed?59:35, rationale:'Longer outputs can explain latency, token-efficiency and cost regressions without a serving defect.' },
    { id:'reward', label:'Reward-model / judge bias (if a preference stage exists)', strength:26, rationale:'Not a primary SFT hypothesis; investigate only if the candidate also passed through preference or reward-guided training.' },
    { id:'serving', label:'Serving / inference configuration', strength:latencyRegressed?41:20, rationale:'Batching, max-token settings, quantization or decoding configuration can create apparent model regressions.' },
  ].sort((a,b)=>b.strength-a.strength);
}

export const recommendedExperiments = [
  'Re-run the candidate on the frozen regression set with identical inference configuration.',
  'Stratify safety failures by task category, language, vulnerability class and prompt length.',
  'Diff baseline and candidate outputs for every newly introduced failure.',
  'Inspect SFT / preference examples nearest to regressed safety tasks for contamination or conflicting supervision.',
  'Measure judge or reward-model correlation against deterministic safety and correctness labels when a preference stage is present.',
  'Run an ablation without the newly added instruction subset to isolate its causal contribution.',
  'Repeat evaluation under matched decoding, batching, quantization and max-token configuration.',
  'Slice latency and cost by generated-token count to separate model behavior from serving overhead.',
];

export function experimentArtifact(experiment: PostTrainingExperiment) {
  const result = assessExperiment(experiment);
  const {metrics: _metrics, ...metadata} = experiment;
  return {
    schemaVersion: '1.0.0',
    artifactType: 'post-training-experiment',
    experiment: metadata,
    metrics: result.metrics,
    decision: result.decision,
    explanation: result.explanation,
    hypotheses: investigationHypotheses(result),
    recommendedExperiments,
  };
}
