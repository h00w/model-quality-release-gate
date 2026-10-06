import { describe, expect, it } from 'vitest';
import { calculateReleaseDecision, DEFAULT_THRESHOLDS } from './evaluation';
import type { Thresholds, EvaluationResult } from '../types/evaluation';
import { demoScenarios } from '../data/demo';

function scenario(id: string) {
  const found = demoScenarios.find(x => x.id === id);
  if (!found) throw new Error(`Missing scenario: ${id}`);
  return found;
}

describe('Phase 1 release gate', () => {
  it('detects latency growth from a zero baseline', () => {
    const s = scenario('ship');
    const baseline = s.baseline.map(row => ({...row, latencyMs: 0}));
    const result = calculateReleaseDecision(baseline, s.candidate);
    expect(result.decision).toBe('INVESTIGATE');
    expect(result.comparisons.find(row => row.key === 'latencyMs')?.status).toBe('REGRESSION');
    expect(result.comparisons.find(row => row.key === 'latencyMs')?.deltaPercent).toBeNull();
    expect(result.explanation).toMatch(/zero baseline/);
    const zero = s.candidate.map(row => ({...row, latencyMs: 0}));
    expect(calculateReleaseDecision(baseline, zero).comparisons.find(row => row.key === 'latencyMs')?.status).toBe('PASS');
  });
  it('rejects malformed browser threshold policies before scoring', () => {
    const s = scenario('ship');
    for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
      for (const value of [NaN, Infinity, -1, true, '2', undefined]) {
        const policy = {...DEFAULT_THRESHOLDS, [key]: value} as unknown as Thresholds;
        expect(() => calculateReleaseDecision(s.baseline, s.candidate, policy)).toThrow(/threshold/i);
      }
      if (key !== 'latencyMs') {
        const policy = {...DEFAULT_THRESHOLDS, [key]: 101};
        expect(() => calculateReleaseDecision(s.baseline, s.candidate, policy)).toThrow(/threshold/i);
      }
    }
  });

  it('requires boolean pass labels in direct evaluation records', () => {
    const s = scenario('safety-hold');
    for (const value of ['false', 'true', 0, 1]) {
      const rows = s.candidate.map(row => ({...row, passed: value} as unknown as EvaluationResult));
      expect(() => calculateReleaseDecision(s.baseline, rows)).toThrow(/passed.*boolean/i);
    }
  });
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

  it('rejects non-finite scores in either baseline or candidate', () => {
    const s = scenario('ship');
    expect(() => calculateReleaseDecision([{...s.baseline[0], safety: Number.NaN}, ...s.baseline.slice(1)], s.candidate)).toThrow(/finite number/);
    expect(() => calculateReleaseDecision(s.baseline, [{...s.candidate[0], latencyMs: Number.POSITIVE_INFINITY}, ...s.candidate.slice(1)])).toThrow(/finite/);
  });

  it('holds when candidate omits or substitutes evaluation cases', () => {
    const s = scenario('ship');
    const missing = calculateReleaseDecision(s.baseline, s.candidate.slice(1));
    expect(missing.decision).toBe('HOLD');
    expect(missing.explanation).toMatch(/1 missing/);
    const substituted = calculateReleaseDecision(s.baseline, [{...s.candidate[0],taskId:'unseen_case'}, ...s.candidate.slice(1)]);
    expect(substituted.decision).toBe('HOLD');
    expect(substituted.explanation).toMatch(/1 unexpected/);
  });

  it('rejects duplicate task IDs before aggregation', () => {
    const s = scenario('ship');
    expect(() => calculateReleaseDecision(s.baseline, [s.candidate[0],s.candidate[0]])).toThrow(/duplicate taskId/);
  });
});
