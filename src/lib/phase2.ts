import type { EvaluationResult } from '../types/evaluation';

export type SafetyFinding = { category: string; count: number; critical: number; high: number; medium: number; low: number };

const clamp01 = (v:number)=>Math.max(0,Math.min(1,v));

export function applyWhatIf(rows: EvaluationResult[], changes: {helpfulness:number;safety:number;reliability:number;codePassRate:number;latencyPct:number}): EvaluationResult[] {
  return rows.map(r=>({
    ...r,
    helpfulness: clamp01(r.helpfulness + changes.helpfulness/100),
    safety: clamp01(r.safety + changes.safety/100),
    reliability: clamp01(r.reliability + changes.reliability/100),
    codePassRate: clamp01(r.codePassRate + changes.codePassRate/100),
    latencyMs: Math.max(0, r.latencyMs * (1 + changes.latencyPct/100)),
  }));
}

export function percentile(values:number[], p:number):number {
  if(!values.length) return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  const idx=(sorted.length-1)*p;
  const lo=Math.floor(idx),hi=Math.ceil(idx);
  if(lo===hi) return sorted[lo];
  return sorted[lo] + (sorted[hi]-sorted[lo])*(idx-lo);
}

export function performanceSummary(rows:EvaluationResult[]){
  const latencies=rows.map(r=>r.latencyMs);
  return {
    p50: percentile(latencies,.5),
    p90: percentile(latencies,.9),
    p95: percentile(latencies,.95),
    p99: percentile(latencies,.99),
    timeoutRate: rows.filter(r=>r.latencyMs>=1500).length/Math.max(rows.length,1)*100,
  };
}

export function safetyFindings(rows:EvaluationResult[]):SafetyFinding[]{
  const map=new Map<string,SafetyFinding>();
  rows.filter(r=>!r.passed && /security|safety|sql|command|path|secret|crypto|auth/i.test(`${r.category} ${r.failureType??''}`)).forEach(r=>{
    const category=r.failureType || r.category || 'Safety issue';
    const current=map.get(category) || {category,count:0,critical:0,high:0,medium:0,low:0};
    current.count += 1;
    if(r.severity) current[r.severity] += 1;
    map.set(category,current);
  });
  return [...map.values()].sort((a,b)=>b.critical-a.critical || b.high-a.high || b.count-a.count);
}

export function coverageSummary(rows:EvaluationResult[]){
  const byCategory=Object.entries(rows.reduce<Record<string,number>>((acc,r)=>{acc[r.category]=(acc[r.category]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]);
  return {
    total: rows.length,
    executed: rows.length,
    successful: rows.filter(r=>r.passed).length,
    failed: rows.filter(r=>!r.passed).length,
    byCategory,
  };
}

export function playgroundEvaluate(prompt:string, mode:'safe'|'unsafe'|'edge'){
  const p=prompt.toLowerCase();
  if(mode==='unsafe' || /sql|query/.test(p)){
    return {
      baseline:'query = f"SELECT * FROM users WHERE id={user_id}"',
      candidate:'cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))',
      summary:'Candidate removes an injection-prone construction and improves the security outcome.',
      deltas:{correctness:8,safety:45,reliability:12,latencyPct:6.4},
    };
  }
  if(mode==='edge' || /divide|duplicate|edge/.test(p)){
    return {
      baseline:'def safe_divide(a,b): return a/b',
      candidate:'def safe_divide(a,b):\n    return None if b == 0 else a / b',
      summary:'Candidate handles the explicit edge condition while preserving the public behavior.',
      deltas:{correctness:30,safety:0,reliability:22,latencyPct:1.8},
    };
  }
  return {
    baseline:'def transform(x): return x',
    candidate:'def transform(x):\n    if x is None:\n        return None\n    return x',
    summary:'Candidate adds defensive handling with a small latency trade-off.',
    deltas:{correctness:10,safety:2,reliability:14,latencyPct:3.1},
  };
}
