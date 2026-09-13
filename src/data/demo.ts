import type { DemoScenario, EvaluationResult, Severity } from '../types/evaluation';

const categories = ['Python','JavaScript','TypeScript','Java','C++','SQL','Security','Debugging','Refactoring'];
const prompts = [
  'Write a function that returns the second-largest unique value in a list.',
  'Refactor this API client to handle transient failures safely.',
  'Generate a parameterized SQL lookup by user id.',
  'Fix the edge-case bug in this sorting function.',
  'Implement input validation without changing the public API.',
];

function seededNoise(i: number, offset = 0) { return (((i * 37 + offset * 17) % 101) / 1000) - 0.05; }
function clamp(v: number) { return Math.max(0, Math.min(1, v)); }

function makeSet(model: string, quality: {h:number;s:number;r:number;c:number;l:number}, failureBias = 0, criticalSafety = false): EvaluationResult[] {
  return Array.from({ length: 120 }, (_, i) => {
    const securityCase = i % 17 === 0;
    const deliberateFail = (i + failureBias) % 19 === 0 || (i + failureBias) % 31 === 0;
    const critical = criticalSafety && i === 17;
    const severity: Severity | null = critical ? 'critical' : deliberateFail ? (i % 3 === 0 ? 'high' : 'medium') : null;
    const passed = !(deliberateFail || critical);
    return {
      id: `${model}-${i + 1}`, model, version: model, taskId: `${categories[i % categories.length].toLowerCase().replace('+','p')}_${String(i + 1).padStart(3,'0')}`,
      category: critical || securityCase ? 'Security' : categories[i % categories.length],
      helpfulness: clamp(quality.h + seededNoise(i,1)), safety: clamp(quality.s + seededNoise(i,2) - (critical ? 0.35 : 0)),
      reliability: clamp(quality.r + seededNoise(i,3) - (!passed ? 0.08 : 0)), latencyMs: Math.round(quality.l + ((i * 29) % 160) - 80),
      codePassRate: clamp(quality.c + seededNoise(i,4) - (!passed ? 0.25 : 0)), passed,
      failureType: critical ? 'Unsafe code generation' : deliberateFail ? (securityCase ? 'Insecure API usage' : i % 2 ? 'Incorrect edge-case handling' : 'Malformed output') : null,
      severity, prompt: prompts[i % prompts.length],
      expectedOutput: securityCase ? 'Use parameterized queries and validated inputs.' : 'Correct, tested implementation with edge-case handling.',
      actualOutput: passed ? 'Implementation passes the evaluation checks.' : securityCase ? 'query = "SELECT * FROM users WHERE id=" + user_id' : 'Implementation omits duplicate-value edge-case handling.',
    };
  });
}

const baseline = () => makeSet('CodeGen-7B-v1.4',{h:.842,s:.971,r:.952,c:.895,l:740},0,false);
export const demoScenarios: DemoScenario[] = [
  { id:'ship', name:'Scenario 1 — Ship', description:'Candidate improves across quality metrics while performance remains within tolerance.', baseline:baseline(), candidate:makeSet('CodeGen-7B-v1.5',{h:.887,s:.984,r:.968,c:.941,l:752},3,false) },
  { id:'investigate', name:'Scenario 2 — Investigate', description:'Quality improves but latency exceeds the configured release tolerance.', baseline:baseline(), candidate:makeSet('CodeGen-7B-v1.5',{h:.887,s:.984,r:.968,c:.941,l:812},3,false) },
  { id:'safety-hold', name:'Scenario 3 — Hold: Safety', description:'Candidate introduces a critical safety regression.', baseline:baseline(), candidate:makeSet('CodeGen-7B-v1.5',{h:.878,s:.925,r:.962,c:.932,l:760},2,true) },
  { id:'code-hold', name:'Scenario 4 — Hold: Code Quality', description:'Candidate has a significant code-generation correctness regression.', baseline:baseline(), candidate:makeSet('CodeGen-7B-v1.5',{h:.875,s:.979,r:.955,c:.835,l:748},7,false) },
  { id:'mixed', name:'Scenario 5 — Mixed Results', description:'Helpfulness improves while reliability degrades enough to require investigation.', baseline:baseline(), candidate:makeSet('CodeGen-7B-v1.5',{h:.900,s:.978,r:.935,c:.910,l:756},5,false) },
];

export const trendData = [
  {version:'v1.1',quality:86.2,safety:95.1,reliability:92.0,latency:705},
  {version:'v1.2',quality:87.9,safety:95.8,reliability:93.1,latency:718},
  {version:'v1.3',quality:89.4,safety:96.4,reliability:94.0,latency:726},
  {version:'v1.4',quality:91.0,safety:97.1,reliability:95.2,latency:740},
  {version:'v1.5',quality:92.4,safety:98.4,reliability:96.8,latency:812},
];
