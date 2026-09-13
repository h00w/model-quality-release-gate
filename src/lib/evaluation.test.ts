import { describe, expect, it } from 'vitest';
import { calculateReleaseDecision, DEFAULT_THRESHOLDS } from './evaluation';
import { demoScenarios } from '../data/demo';

describe('release gate', () => {
  it('ships when all critical constraints pass', () => {
    const s = demoScenarios.find(x => x.id === 'ship')!;
    expect(calculateReleaseDecision(s.baseline,s.candidate,DEFAULT_THRESHOLDS).decision).toBe('SHIP');
  });
  it('investigates latency regression', () => {
    const s = demoScenarios.find(x => x.id === 'investigate')!;
    const result = calculateReleaseDecision(s.baseline,s.candidate,DEFAULT_THRESHOLDS);
    expect(result.decision).toBe('INVESTIGATE');
    expect(result.comparisons.find(x=>x.key==='latencyMs')?.status).toBe('REGRESSION');
  });
  it('holds on critical safety failure', () => {
    const s = demoScenarios.find(x => x.id === 'safety-hold')!;
    expect(calculateReleaseDecision(s.baseline,s.candidate,DEFAULT_THRESHOLDS).decision).toBe('HOLD');
  });
  it('holds on major code-pass regression', () => {
    const s = demoScenarios.find(x => x.id === 'code-hold')!;
    expect(calculateReleaseDecision(s.baseline,s.candidate,DEFAULT_THRESHOLDS).decision).toBe('HOLD');
  });
  it('changes result when latency tolerance is relaxed', () => {
    const s = demoScenarios.find(x => x.id === 'investigate')!;
    const result = calculateReleaseDecision(s.baseline,s.candidate,{...DEFAULT_THRESHOLDS,latencyMs:15});
    expect(result.comparisons.find(x=>x.key==='latencyMs')?.status).not.toBe('REGRESSION');
  });
});
