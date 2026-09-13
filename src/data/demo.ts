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

function makeSet(
  model: string,
  quality: {h:number;s:number;r:number;c:number;l:number},
  failureBias = 0,
  criticalSafetyCount = 0,
): EvaluationResult[] {
  return Array.from({ length: 120 }, (_, i) => {
    const securityCase = i % 17 === 0;
    const deliberateFail = (i + failureBias) % 19 === 0 || (i + failureBias) % 31 === 0;
    const critical = criticalSafetyCount > 0 && i >= 17 && i < 17 + criticalSafetyCount;
    const severity: Severity | null = critical ? 'critical' : deliberateFail ? (i % 3 === 0 ? 'high' : 'medium') : null;
    const passed = !(deliberateFail || critical);
    return {
      id: `${model}-${i + 1}`,
      model,
      version: model,
      taskId: `${categories[i % categories.length].toLowerCase().replace('+','p')}_${String(i + 1).padStart(3,'0')}`,
      category: critical || securityCase ? 'Security' : categories[i % categories.length],
      helpfulness: clamp(quality.h + seededNoise(i,1)),
      safety: clamp(quality.s + seededNoise(i,2) - (critical ? 0.35 : 0)),
      reliability: clamp(quality.r + seededNoise(i,3) - (!passed ? 0.08 : 0)),
      latencyMs: Math.round(quality.l + ((i * 29) % 160) - 80),
      codePassRate: clamp(quality.c + seededNoise(i,4) - (!passed ? 0.25 : 0)),
      passed,
      failureType: critical ? 'Unsafe code generation' : deliberateFail ? (securityCase ? 'Insecure API usage' : i % 2 ? 'Incorrect edge-case handling' : 'Malformed output') : null,
      severity,
      prompt: prompts[i % prompts.length],
      expectedOutput: securityCase ? 'Use parameterized queries and validated inputs.' : 'Correct, tested implementation with edge-case handling.',
      actualOutput: passed ? 'Implementation passes the evaluation checks.' : securityCase ? 'query = "SELECT * FROM users WHERE id=" + user_id' : 'Implementation omits duplicate-value edge-case handling.',
    };
  });
}

const baseline = () => makeSet('CodeGen-7B-v1.4',{h:.842,s:.971,r:.952,c:.895,l:740});

export const demoScenarios: DemoScenario[] = [
  {
    id:'ship',
    name:'Candidate improves overall',
    description:'Quality improves across the board and latency remains inside the production tolerance.',
    baseline:baseline(),
    candidate:makeSet('CodeGen-7B-v1.5',{h:.887,s:.984,r:.968,c:.941,l:752},3),
  },
  {
    id:'investigate',
    name:'Latency regression',
    description:'Quality improves, but candidate latency exceeds the configured production tolerance.',
    baseline:baseline(),
    candidate:makeSet('CodeGen-7B-v1.5',{h:.887,s:.984,r:.968,c:.941,l:812},3),
  },
  {
    id:'safety-hold',
    name:'Safety regression',
    description:'The candidate is stronger on several metrics but introduces a critical unsafe-code failure.',
    baseline:baseline(),
    candidate:makeSet('CodeGen-7B-v1.5',{h:.878,s:.925,r:.962,c:.932,l:760},2,1),
  },
  {
    id:'code-hold',
    name:'Code quality regression',
    description:'The candidate regresses materially on code correctness and violates the release policy.',
    baseline:baseline(),
    candidate:makeSet('CodeGen-7B-v1.5',{h:.875,s:.979,r:.955,c:.835,l:748},7),
  },
  {
    id:'mixed',
    name:'Mixed trade-offs',
    description:'Helpfulness improves while reliability softens enough to require engineering review.',
    baseline:baseline(),
    candidate:makeSet('CodeGen-7B-v1.5',{h:.900,s:.978,r:.935,c:.910,l:756},5),
  },
  {
    id:'catastrophic',
    name:'Catastrophic failure',
    description:'Multiple critical safety failures combine with major reliability, correctness and latency regressions.',
    baseline:baseline(),
    candidate:makeSet('CodeGen-7B-v1.5-rc-bad',{h:.790,s:.820,r:.860,c:.750,l:980},11,4),
  },
];

export const trendData = [
  {version:'v1.1',quality:86.2,safety:95.1,reliability:92.0,latency:705},
  {version:'v1.2',quality:87.9,safety:95.8,reliability:93.1,latency:718},
  {version:'v1.3',quality:89.4,safety:96.4,reliability:94.0,latency:726},
  {version:'v1.4',quality:91.0,safety:97.1,reliability:95.2,latency:740},
  {version:'v1.5',quality:92.4,safety:98.4,reliability:96.8,latency:812},
];
