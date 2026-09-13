import { describe, expect, it } from 'vitest';
import { applyWhatIf, coverageSummary, performanceSummary, safetyFindings } from './phase2';
import { demoScenarios } from '../data/demo';

describe('phase 2 evaluation controls',()=>{
  const candidate=demoScenarios.find(s=>s.id==='investigate')!.candidate;

  it('applies what-if changes without mutating source evidence',()=>{
    const originalSafety=candidate[0].safety;
    const simulated=applyWhatIf(candidate,{helpfulness:1,safety:-2,reliability:0,codePassRate:0,latencyPct:-10});
    expect(candidate[0].safety).toBe(originalSafety);
    expect(simulated[0].safety).toBeCloseTo(Math.max(0,originalSafety-.02));
    expect(simulated[0].latencyMs).toBeCloseTo(candidate[0].latencyMs*.9);
  });

  it('computes ordered latency percentiles',()=>{
    const p=performanceSummary(candidate);
    expect(p.p50).toBeLessThanOrEqual(p.p90);
    expect(p.p90).toBeLessThanOrEqual(p.p95);
    expect(p.p95).toBeLessThanOrEqual(p.p99);
  });

  it('reports executed coverage consistently',()=>{
    const coverage=coverageSummary(candidate);
    expect(coverage.total).toBe(candidate.length);
    expect(coverage.executed).toBe(candidate.length);
    expect(coverage.successful+coverage.failed).toBe(candidate.length);
  });

  it('aggregates safety-classified findings',()=>{
    const safetyCandidate=demoScenarios.find(s=>s.id==='safety-hold')!.candidate;
    const findings=safetyFindings(safetyCandidate);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.reduce((n,f)=>n+f.critical,0)).toBeGreaterThan(0);
  });
});
