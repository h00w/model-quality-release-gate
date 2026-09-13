import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Github, Moon, Search, ShieldAlert, Sun, Upload } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { demoScenarios, trendData } from './data/demo';
import { calculateReleaseDecision, DEFAULT_THRESHOLDS, normalizeImportedRow, validateEvaluation } from './lib/evaluation';
import type { EvaluationResult, MetricKey, Thresholds } from './types/evaluation';

const formatMetric = (key: MetricKey, value: number) => key === 'latencyMs' ? `${Math.round(value)} ms` : `${value.toFixed(1)}%`;

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.trim().split(/\r?\n/); const headers = lines[0].split(',').map(s => s.trim());
  return lines.slice(1).map(line => { const cols = line.split(','); return Object.fromEntries(headers.map((h,i) => [h, cols[i]?.trim()])); });
}

export default function App() {
  const [scenarioId,setScenarioId] = useState('investigate'); const [thresholds,setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [dark,setDark] = useState(true); const [query,setQuery] = useState(''); const [severity,setSeverity] = useState('all'); const [imported,setImported] = useState<EvaluationResult[] | null>(null); const [message,setMessage] = useState('');
  const scenario = demoScenarios.find(s => s.id === scenarioId)!;
  const candidate = imported ?? scenario.candidate; const gate = useMemo(() => calculateReleaseDecision(scenario.baseline,candidate,thresholds),[scenario,candidate,thresholds]);
  const failures = candidate.filter(r => !r.passed).filter(r => severity === 'all' || r.severity === severity).filter(r => `${r.taskId} ${r.category} ${r.failureType} ${r.prompt}`.toLowerCase().includes(query.toLowerCase()));
  const comparisonData = gate.comparisons.filter(c=>c.key!=='latencyMs').map(c=>({metric:c.label,Baseline:c.baseline,Candidate:c.candidate}));

  async function onFile(file?: File) {
    if (!file) return; setMessage('Validating evaluation data…');
    try { const text = await file.text(); let raw: Record<string, unknown>[];
      if (file.name.endsWith('.csv')) raw = parseCsv(text); else if (file.name.endsWith('.jsonl')) raw = text.trim().split(/\r?\n/).map(l=>JSON.parse(l)); else raw = JSON.parse(text);
      const rows = raw.map(normalizeImportedRow); validateEvaluation(rows); setImported(rows); setMessage(`Imported ${rows.length} evaluation rows.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to parse evaluation data.'); }
  }
  function exportCsv() { const h=['taskId','category','helpfulness','safety','reliability','latencyMs','codePassRate','passed','failureType','severity']; const body=[h.join(','),...candidate.map(r=>h.map(k=>String((r as unknown as Record<string, unknown>)[k] ?? '')).join(','))].join('\n'); download(body,'evaluation-results.csv','text/csv'); }
  function exportReport() { const lines=[`MODEL QUALITY RELEASE GATE`,`Run #2026-09-12-0042`,`Baseline: ${scenario.baseline[0].model}`,`Candidate: ${candidate[0]?.model ?? 'Imported candidate'}`,'',...gate.comparisons.map(c=>`${c.label}: ${formatMetric(c.key,c.baseline)} → ${formatMetric(c.key,c.candidate)} [${c.status}]`),'',`DECISION: ${gate.decision}`,gate.explanation,'',`Failures: ${gate.candidate.failures} | Critical: ${gate.candidate.criticalFailures}`]; download(lines.join('\n'),'model-quality-release-report.txt','text/plain'); }
  function download(content:string,name:string,type:string){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href);}

  return <div className={dark?'app dark':'app'}>
    <header><div><span className="eyebrow">AI EVALUATION · RELEASE ENGINEERING</span><h1>Model Quality Release Gate</h1><p>Evaluate. Compare. Detect regressions. Decide whether an AI coding model is ready to ship.</p></div><div className="headerActions"><a className="iconBtn" href="https://github.com/h00w/model-quality-release-gate" target="_blank" aria-label="GitHub"><Github/></a><button className="iconBtn" onClick={()=>setDark(!dark)} aria-label="Toggle theme">{dark?<Sun/>:<Moon/>}</button></div></header>
    <nav><button className="active">Dashboard</button><a href="#comparison">Comparisons</a><a href="#failures">Failures</a><a href="#decision">Release Decision</a><a href="#docs">Documentation</a></nav>
    <main>
      <section className="controls card"><div><label>Demo scenario</label><select value={scenarioId} onChange={e=>{setScenarioId(e.target.value);setImported(null)}}>{demoScenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><small>{scenario.description}</small></div><div><label>Evaluation run</label><strong>Run #2026-09-12-0042</strong><small>CodeBench-Safety v1.0 · {gate.candidate.samples} samples</small></div><div><label>Import candidate results</label><label className="upload"><Upload size={16}/> CSV / JSON / JSONL<input type="file" accept=".csv,.json,.jsonl" onChange={e=>onFile(e.target.files?.[0])}/></label><small>{message || 'Schema is validated before import.'}</small></div></section>

      <section className="modelRow"><div className="modelCard"><span>BASELINE</span><strong>{scenario.baseline[0].model}</strong></div><div className="arrow">→</div><div className="modelCard"><span>CANDIDATE</span><strong>{candidate[0]?.model ?? 'Imported model'}</strong></div><div className={`decisionBadge ${gate.decision.toLowerCase()}`}>{gate.decision}</div></section>

      <section className="metrics">{gate.comparisons.map(c=><article className="card metric" key={c.key}><div className="metricTop"><span>{c.label}</span><span className={`status ${c.status.toLowerCase()}`}>{c.status}</span></div><strong>{formatMetric(c.key,c.candidate)}</strong><small>Baseline {formatMetric(c.key,c.baseline)} · {c.key==='latencyMs'?`${c.deltaPercent>0?'+':''}${c.deltaPercent}%`:`${c.delta>0?'+':''}${c.delta.toFixed(1)} pts`}</small></article>)}<article className="card metric"><div className="metricTop"><span>Overall Quality</span><span className="status pass">SCORE</span></div><strong>{gate.candidate.qualityScore.toFixed(1)}</strong><small>Baseline {gate.baseline.qualityScore.toFixed(1)} · {(gate.candidate.qualityScore-gate.baseline.qualityScore>=0?'+':'')+(gate.candidate.qualityScore-gate.baseline.qualityScore).toFixed(1)}</small></article></section>

      {gate.comparisons.some(c=>c.status==='REGRESSION') && <section className="alert"><AlertTriangle/><div><strong>Regression detected</strong><p>{gate.comparisons.filter(c=>c.status==='REGRESSION').map(c=>`${c.label} exceeds its configured tolerance (${c.threshold}%).`).join(' ')}</p></div></section>}

      <section id="decision" className={`decision card ${gate.decision.toLowerCase()}`}><div><span className="eyebrow">RELEASE DECISION</span><h2>{gate.decision}</h2><p>{gate.explanation}</p></div><div className="decisionStats"><div><span>Failures</span><strong>{gate.candidate.failures}</strong></div><div><span>Critical</span><strong>{gate.candidate.criticalFailures}</strong></div><div><span>Quality Δ</span><strong>{(gate.candidate.qualityScore-gate.baseline.qualityScore).toFixed(1)}</strong></div></div><div className="actions"><button onClick={exportReport}><Download size={16}/> Export report</button><button onClick={exportCsv}><Download size={16}/> Export CSV</button></div></section>

      <section id="comparison" className="grid2"><article className="card chart"><h2>Model comparison</h2><p>Higher is better for normalized quality metrics.</p><ResponsiveContainer width="100%" height={310}><BarChart data={comparisonData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="metric"/><YAxis domain={[0,100]}/><Tooltip/><Legend/><Bar dataKey="Baseline" fill="currentColor" opacity={.35}/><Bar dataKey="Candidate" fill="currentColor" opacity={.9}/></BarChart></ResponsiveContainer></article><article className="card chart"><h2>Evaluation trends</h2><p>Quality trajectory across fictional demo model versions.</p><ResponsiveContainer width="100%" height={310}><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="version"/><YAxis domain={[80,100]}/><Tooltip/><Legend/><Line type="monotone" dataKey="quality"/><Line type="monotone" dataKey="safety"/><Line type="monotone" dataKey="reliability"/></LineChart></ResponsiveContainer></article></section>

      <section className="card thresholds"><div><h2>Release thresholds</h2><p>Changes recompute regression states and the release decision immediately.</p></div><div className="thresholdGrid">{Object.entries(thresholds).map(([key,val])=><label key={key}>{key==='latencyMs'?'Latency regression':key.replace(/([A-Z])/g,' $1')} tolerance (%)<input type="number" min="0" step="0.5" value={val} onChange={e=>setThresholds({...thresholds,[key]:Number(e.target.value)})}/></label>)}</div></section>

      <section id="failures" className="card"><div className="sectionHead"><div><h2>Failure explorer</h2><p>Inspect candidate failures and their release impact.</p></div><div className="filters"><div className="search"><Search size={15}/><input placeholder="Search failures" value={query} onChange={e=>setQuery(e.target.value)}/></div><select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="all">All severities</option><option>critical</option><option>high</option><option>medium</option><option>low</option></select></div></div><div className="failureList">{failures.slice(0,12).map(f=><details key={f.id}><summary><span><strong>{f.taskId}</strong> · {f.category}</span><span className={`severity ${f.severity}`}>{f.severity ?? 'unknown'}</span></summary><div className="failureBody"><div><b>Failure</b><p>{f.failureType}</p><b>Prompt</b><pre>{f.prompt}</pre></div><div><b>Expected</b><pre>{f.expectedOutput}</pre><b>Candidate output</b><pre>{f.actualOutput}</pre></div></div></details>)}{!failures.length&&<p className="empty">No failures match the current filters.</p>}</div></section>

      <section id="docs" className="card docs"><ShieldAlert/><div><h2>Evaluation pipeline</h2><p>Model → Evaluation Dataset → Benchmark → Metrics → Regression Detection → Failure Analysis → Release Gate → <b>SHIP / INVESTIGATE / HOLD</b></p><p>Demo model names and results are fictional. The project demonstrates evaluation methodology and deterministic release engineering, not claims about real models.</p></div></section>
    </main><footer><span>Model Quality Release Gate · Hendarmawan, PhD Eng.</span><span><a href="https://github.com/h00w">GitHub</a> · <a href="https://www.linkedin.com/in/hender/">LinkedIn</a> · <a href="https://hendarmawan.se">hendarmawan.se</a></span></footer>
  </div>;
}
