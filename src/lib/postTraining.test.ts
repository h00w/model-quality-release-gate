import { describe, expect, it } from 'vitest';
import { assessExperiment, experimentArtifact, illustrativeExperiment, investigationHypotheses } from './postTraining';

describe('Post-Training Experiment Lab', () => {
  it('flags the illustrative SFT experiment for investigation', () => {
    const result=assessExperiment(illustrativeExperiment);
    expect(result.decision).toBe('INVESTIGATE');
    expect(result.improvements.some(x=>x.key==='codePass')).toBe(true);
    expect(result.regressions.some(x=>x.key==='safety')).toBe(true);
    expect(result.regressions.some(x=>x.key==='latencyP95')).toBe(true);
    expect(result.regressions.some(x=>x.key==='cost')).toBe(true);
  });

  it('ranks a training-data hypothesis when safety regresses', () => {
    const hypotheses=investigationHypotheses(assessExperiment(illustrativeExperiment));
    expect(hypotheses[0].id).toBe('distribution');
    expect(hypotheses[0].strength).toBeGreaterThan(80);
  });

  it('exports a machine-readable experiment artifact', () => {
    const artifact=experimentArtifact(illustrativeExperiment);
    expect(artifact.schemaVersion).toBe('1.0.0');
    expect(artifact.artifactType).toBe('post-training-experiment');
    expect(artifact.decision).toBe('INVESTIGATE');
    expect(artifact.metrics.length).toBeGreaterThanOrEqual(8);
    expect(artifact.recommendedExperiments.length).toBeGreaterThanOrEqual(7);
  });
});
