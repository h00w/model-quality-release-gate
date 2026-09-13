import { describe, expect, it } from 'vitest';
import { calculateReleaseDecision, DEFAULT_THRESHOLDS } from './evaluation';
import { demoScenarios } from '../data/demo';

function scenario(id: string) {
  const found = demoScenarios.find(x => x.id === id);
  if (!found) throw new Error(`Missing scenario: ${id}`);
  return found;
}

describe('Phase 1 release gate', () => {
  it('ships when all critical constraints pass', () => {
    const s = scenario('ship');
    expect(calculateReleaseDecision(s.baseline,s.candidate,DEFAULT_THRESHOLDS).decision).toBe('SHIP');
  });

  it('investigates latency regression', () => {
    const s = scenario('investigate');
    const result = calculateReleaseDecision(s.baseline,s.candidate,DEFAULT_THRESHOLDS);
    expect(result.decision).toBe('INVESTIGATE');
    expect(result.comparisons.find(x=>x.key==='latencyMs')?.status).toBe('REGRESSION');
  });

  it('holds on critical safety failure', () => {
    const s = scenario('safety-hold');
    const result = calculateReleaseDecision(s.baseline,s.candidate,DEFAULT_THRESHOLDS);
    expect(result.decision).toBe('HOLD');
    expect(result.candidate.criticalFailures).toBeGreaterThan(0);
  });

  it('holds on major code-pass regression', () => {
    const s = scenario('code-hold');
    expect(calculateReleaseDecision(s.baseline,s.candidate,DEFAULT_THRESHOLDS).decision).toBe('HOLD');
  });

  it('investigates mixed trade-offs', () => {
    const s = scenario('mixed');
    expect(calculateReleaseDecision(s.baseline,s.candidate,DEFAULT_THRESHOLDS).decision).toBe('INVESTIGATE');
  });

  it('holds catastrophic candidates with multiple critical failures', () => {
    const s = scenario('catastrophic');
    const result = calculateReleaseDecision(s.baseline,s.candidate,DEFAULT_THRESHOLDS);
    expect(result.decision).toBe('HOLD');
    expect(result.candidate.criticalFailures).toBeGreaterThanOrEqual(4);
  });

  it('changes latency regression status when tolerance is relaxed', () => {
    const s = scenario('investigate');
    const result = calculateReleaseDecision(s.baseline,s.candidate,{...DEFAULT_THRESHOLDS,latencyMs:15});
    expect(result.comparisons.find(x=>x.key==='latencyMs')?.status).not.toBe('REGRESSION');
  });
});
