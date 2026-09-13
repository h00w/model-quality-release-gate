import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const inputPath = process.argv[2] || 'release/candidate-release.json';
const outDir = process.argv[3] || 'artifacts/release-gate';
const enforce = process.argv.includes('--enforce');

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const now = process.env.GITHUB_RUN_ID ? new Date().toISOString() : (input.evaluatedAt || '2026-09-13T00:00:00.000Z');
const thresholds = input.thresholds;
const baseline = input.baseline;
const candidate = input.candidate;

const defs = [
  ['helpfulness','Helpfulness','higher'],
  ['safety','Safety','higher'],
  ['reliability','Reliability','higher'],
  ['codePassRate','Code Pass Rate','higher'],
  ['latencyMs','Latency','lower'],
];

const comparisons = defs.map(([key,label,direction]) => {
  const b = baseline.metrics[key];
  const c = candidate.metrics[key];
  const delta = c - b;
  const deltaPercent = b === 0 ? 0 : delta / b * 100;
  const tolerance = thresholds[key];
  let status = 'PASS';
  if (direction === 'higher') {
    if (delta < -tolerance) status = 'REGRESSION';
    else if (delta < -(tolerance * 0.5)) status = 'WARNING';
  } else {
    if (deltaPercent > tolerance) status = 'REGRESSION';
    else if (deltaPercent > tolerance * 0.8) status = 'WARNING';
  }
  return {key,label,direction,baseline:b,candidate:c,delta:+delta.toFixed(4),deltaPercent:+deltaPercent.toFixed(4),threshold:tolerance,status};
});

const byKey = Object.fromEntries(comparisons.map(x => [x.key,x]));
const reasons = [];
let decision = 'SHIP';

if ((candidate.criticalFailures || 0) > 0) {
  decision = 'HOLD';
  reasons.push(`${candidate.criticalFailures} critical failure(s) detected`);
}
const majorHigherRegression = key => byKey[key].delta < -(thresholds[key] * 1.5);
if (majorHigherRegression('safety')) { decision='HOLD'; reasons.push('major safety regression'); }
if (majorHigherRegression('reliability')) { decision='HOLD'; reasons.push('major reliability regression'); }
if (majorHigherRegression('codePassRate')) { decision='HOLD'; reasons.push('major correctness regression'); }
if (decision !== 'HOLD' && byKey.latencyMs.status === 'REGRESSION') { decision='INVESTIGATE'; reasons.push('latency regression exceeds tolerance'); }
if (decision === 'SHIP' && comparisons.some(x => x.status !== 'PASS')) { decision='INVESTIGATE'; reasons.push('minor adverse trade-off requires review'); }

const quality = m => +(0.25*m.helpfulness + 0.20*m.safety + 0.20*m.reliability + 0.35*m.codePassRate).toFixed(4);
const decisionArtifact = {
  schemaVersion: '1.0.0',
  run: {
    runId: input.runId,
    benchmark: input.benchmark,
    evaluatedAt: now,
    sourceCommit: process.env.GITHUB_SHA || input.sourceCommit || 'local',
    workflowRunId: process.env.GITHUB_RUN_ID || null,
  },
  baseline: {...baseline, qualityScore: quality(baseline.metrics)},
  candidate: {...candidate, qualityScore: quality(candidate.metrics)},
  thresholds,
  comparisons,
  decision,
  policyVersion: input.policyVersion,
  explanation: reasons.length ? reasons.join('; ') : 'All configured release constraints pass.',
};

fs.mkdirSync(outDir, {recursive:true});
const decisionPath = path.join(outDir, 'decision.json');
fs.writeFileSync(decisionPath, JSON.stringify(decisionArtifact, null, 2) + '\n');

const sourceBytes = fs.readFileSync(inputPath);
const decisionBytes = fs.readFileSync(decisionPath);
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const manifest = {
  schemaVersion: '1.0.0',
  artifactType: 'model-release-evidence',
  immutableIdentity: `${input.runId}:${process.env.GITHUB_SHA || input.sourceCommit || 'local'}`,
  generatedAt: now,
  decision,
  benchmark: input.benchmark,
  policyVersion: input.policyVersion,
  files: [
    {path:path.basename(inputPath), sha256:sha256(sourceBytes), bytes:sourceBytes.length, role:'release-input'},
    {path:'decision.json', sha256:sha256(decisionBytes), bytes:decisionBytes.length, role:'machine-readable-decision'},
  ],
};
fs.copyFileSync(inputPath, path.join(outDir, path.basename(inputPath)));
fs.writeFileSync(path.join(outDir,'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'checksums.sha256'), `${manifest.files[0].sha256}  ${path.basename(inputPath)}\n${manifest.files[1].sha256}  decision.json\n`);
fs.writeFileSync(path.join(outDir,'summary.md'), `# Release Gate Evidence\n\n- **Run:** ${input.runId}\n- **Benchmark:** ${input.benchmark.name} ${input.benchmark.version}\n- **Baseline:** ${baseline.model}\n- **Candidate:** ${candidate.model}\n- **Decision:** **${decision}**\n- **Policy:** ${input.policyVersion}\n- **Explanation:** ${decisionArtifact.explanation}\n\n## Metric gates\n\n| Metric | Baseline | Candidate | Delta | Gate |\n|---|---:|---:|---:|---|\n${comparisons.map(x=>`| ${x.label} | ${x.baseline} | ${x.candidate} | ${x.direction==='lower'?x.deltaPercent.toFixed(2)+'%':x.delta.toFixed(2)} | ${x.status} |`).join('\n')}\n`);

console.log(JSON.stringify({decision, explanation:decisionArtifact.explanation, evidenceDir:outDir}));
if (enforce && decision === 'HOLD') process.exit(42);
