import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Moon, Search, ShieldAlert, Sun, Upload, XCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { demoScenarios } from './data/demo';
import { calculateReleaseDecision, DEFAULT_THRESHOLDS, normalizeImportedRow, validateEvaluation } from './lib/evaluation';
import type { EvaluationResult, MetricKey } from './types/evaluation';

const formatMetric = (key: MetricKey, value: number) => key === 'latencyMs' ? `${Math.round(value)} ms` : `${value.toFixed(1)}%`;
const deltaText = (key: MetricKey, delta: number, deltaPercent: number) => key === 'latencyMs'
  ? `${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(1)}%`
  : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts`;

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(s => s.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    return Object.fromEntries(headers.map((h,i) => [h, cols[i]?.trim()]));
  });
}

export default function App() {
  const [scenarioId,setScenarioId] = useState('investigate');
  const [dark,setDark] = useState(true);
  const [query,setQuery] = useState('');
  const [severity,setSeverity] = useState('all');
  const [imported,setImported] = useState<EvaluationResult[] | null>(null);
  const [message,setMessage] = useState('');
  const [whyOpen,setWhyOpen] = useState(true);

  const scenario = demoScenarios.find(s => s.id === scenarioId)!;
  const candidate = imported ?? scenario.candidate;
  const gate = useMemo(() => calculateReleaseDecision(scenario.baseline,candidate,DEFAULT_THRESHOLDS),[scenario,candidate]);
  const failures = candidate
    .filter(r => !r.passed)
    .filter(r => severity === 'all' || r.severity === severity)
    .filter(r => `${r.taskId} ${r.category} ${r.failureType} ${r.prompt}`.toLowerCase().includes(query.toLowerCase()));
  const comparisonData = gate.comparisons
    .filter(c => c.key !== 'latencyMs')
    .map(c => ({metric:c.label,Baseline:c.baseline,Candidate:c.candidate}));
  const regressions = gate.comparisons.filter(c => c.status === 'REGRESSION');
  const warnings = gate.comparisons.filter(c => c.status === 'WARNING');
  const improved = gate.comparisons.filter(c => c.direction === 'higher' && c.delta > 0);

  async function onFile(file?: File) {
    if (!file) return;
    setMessage('Validating evaluation data…');
    try {
      const text = await file.text();
      let raw: Record<string, unknown>[];
      if (file.name.endsWith('.csv')) raw = parseCsv(text);
      else if (file.name.endsWith('.jsonl')) raw = text.trim().split(/\r?\n/).map(l=>JSON.parse(l));
      else raw = JSON.parse(text);
      const rows = raw.map(normalizeImportedRow);
      validateEvaluation(rows);
      setImported(rows);
      setMessage(`Imported ${rows.length} evaluation rows.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to parse evaluation data.');
    }
  }

  function exportCsv() {
    const h=['taskId','category','helpfulness','safety','reliability','latencyMs','codePassRate','passed','failureType','severity'];
    const body=[h.join(','),...candidate.map(r=>h.map(k=>String((r as unknown as Record<string, unknown>)[k] ?? '')).join(','))].join('\n');
    download(body,'evaluation-results.csv','text/csv');
  }

  function exportReport() {
    const lines=[
      'AI MODEL RELEASE CONTROL CENTER',
      'Phase 1 evaluation report',
      `Baseline: ${scenario.baseline[0].model}`,
      `Candidate: ${candidate[0]?.model ?? 'Imported candidate'}`,
      '',
      ...gate.comparisons.map(c=>`${c.label}: ${formatMetric(c.key,c.baseline)} → ${formatMetric(c.key,c.candidate)} (${deltaText(c.key,c.delta,c.deltaPercent)}) [${c.status}]`),
      '',
      `DECISION: ${gate.decision}`,
      gate.explanation,
      '',
      `Failures: ${gate.candidate.failures}`,
      `Critical failures: ${gate.candidate.criticalFailures}`,
      `Samples: ${gate.candidate.samples}`,
    ];
    download(lines.join('\n'),'model-quality-release-report.txt','text/plain');
  }

  function download(content:string,name:string,type:string){
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([content],{type}));
    a.download=name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return <div className={dark?'app dark':'app'}>
    <header>
      <div>
        <span className="eyebrow">PHASE 1 · AI EVALUATION · RELEASE ENGINEERING</span>
        <h1>AI Model Release Control Center</h1>
        <p className="subtitle">Evaluate → Compare → Investigate → Gate → Ship</p>
      </div>
      <div className="headerActions">
        <a className="textBtn" href="https://github.com/h00w/model-quality-release-gate" target="_blank" rel="noreferrer">GitHub</a>
        <a className="textBtn" href="https://huggingface.co/spaces/h0000w/model-quality-release-gate" target="_blank" rel="noreferrer">HF Space</a>
        <button className="iconBtn" onClick={()=>setDark(!dark)} aria-label="Toggle theme">{dark?<Sun/>:<Moon/>}</button>
      </div>
    </header>

    <nav>
      <a href="#dashboard" className="active">Dashboard</a>
      <a href="#comparison">Model Compare</a>
      <a href="#regressions">Regressions</a>
      <a href="#failures">Failures</a>
      <a href="#decision">Release Gate</a>
      <a href="#evidence">Evidence</a>
    </nav>

    <main id="dashboard">
      <section className="controls card">
        <div>
          <label>Demo scenario</label>
          <select value={scenarioId} onChange={e=>{setScenarioId(e.target.value);setImported(null);setWhyOpen(true)}}>
            {demoScenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <small>{scenario.description}</small>
        </div>
        <div>
          <label>Evaluation profile</label>
          <strong>CodeBench-Safety v1.0</strong>
          <small>{gate.candidate.samples} deterministic evaluation cases · fixed release policy</small>
        </div>
        <div>
          <label>Import candidate results</label>
          <label className="upload"><Upload size={16}/> CSV / JSON / JSONL<input type="file" accept=".csv,.json,.jsonl" onChange={e=>onFile(e.target.files?.[0])}/></label>
          <small>{message || 'Schema validated before release analysis.'}</small>
        </div>
      </section>

      <section className={`releaseHero card ${gate.decision.toLowerCase()}`}>
        <div className="releaseModels">
          <span>PRODUCTION BASELINE</span>
          <strong>{scenario.baseline[0].model}</strong>
          <b>→</b>
          <span>CANDIDATE</span>
          <strong>{candidate[0]?.model ?? 'Imported model'}</strong>
        </div>
        <div className="releaseVerdict">
          <span className="eyebrow">RELEASE VERDICT</span>
          <h2>{gate.decision}</h2>
          <p>{gate.explanation}</p>
          <div className="heroActions">
            <button onClick={()=>setWhyOpen(!whyOpen)}>Why this decision?</button>
            <a href="#failures">Investigate failures</a>
          </div>
        </div>
      </section>

      <section className="metrics">
        {gate.comparisons.map(c=><article className="card metric" key={c.key}>
          <div className="metricTop"><span>{c.label}</span><span className={`status ${c.status.toLowerCase()}`}>{c.status}</span></div>
          <strong>{formatMetric(c.key,c.candidate)}</strong>
          <small>Baseline {formatMetric(c.key,c.baseline)}</small>
          <div className={`delta ${c.status.toLowerCase()}`}>{deltaText(c.key,c.delta,c.deltaPercent)}</div>
        </article>)}
      </section>

      {whyOpen && <section className="card whyPanel">
        <div className="sectionHead compact"><div><span className="eyebrow">EXPLAIN THIS DECISION</span><h2>Why {gate.decision}?</h2></div></div>
        <div className="whyGrid">
          <div>
            <h3>Evidence</h3>
            <ul>
              <li>{improved.length} higher-is-better metrics improved.</li>
              <li>{regressions.length} metric{regressions.length===1?'':'s'} exceeded release tolerance.</li>
              <li>{gate.candidate.criticalFailures} critical failure{gate.candidate.criticalFailures===1?'':'s'} detected.</li>
              <li>{gate.candidate.failures} total candidate failures across {gate.candidate.samples} cases.</li>
            </ul>
          </div>
          <div>
            <h3>Policy interpretation</h3>
            <p>{gate.decision === 'SHIP' && 'All critical constraints pass. The candidate is stable or improved enough to proceed.'}</p>
            <p>{gate.decision === 'INVESTIGATE' && 'The candidate has useful gains, but at least one non-critical release constraint requires engineering review before production promotion.'}</p>
            <p>{gate.decision === 'HOLD' && 'A critical or material regression violates the release policy. Production promotion is blocked until remediation and re-evaluation.'}</p>
          </div>
        </div>
      </section>}

      <section id="regressions" className="card regressionPanel">
        <div className="sectionHead compact">
          <div><span className="eyebrow">REGRESSION DETECTION</span><h2>What changed?</h2><p>Only adverse changes drive the release gate.</p></div>
        </div>
        <div className="regressionList">
          {regressions.map(c=><div className="regressionRow" key={c.key}><XCircle/><strong>{c.label}</strong><span>{deltaText(c.key,c.delta,c.deltaPercent)}</span><small>threshold {c.threshold}{c.key==='latencyMs'?'%':' pts'}</small><b>REGRESSION</b></div>)}
          {warnings.map(c=><div className="regressionRow warningRow" key={c.key}><AlertTriangle/><strong>{c.label}</strong><span>{deltaText(c.key,c.delta,c.deltaPercent)}</span><small>inside hard limit but moved adversely</small><b>WARNING</b></div>)}
          {!regressions.length && !warnings.length && <div className="allClear"><CheckCircle2/><span>No adverse metric movement requiring release review.</span></div>}
        </div>
      </section>

      <section id="comparison" className="grid2">
        <article className="card chart">
          <span className="eyebrow">BASELINE VS CANDIDATE</span><h2>Normalized quality comparison</h2><p>Higher is better for helpfulness, safety, reliability and code pass rate.</p>
          <ResponsiveContainer width="100%" height={320}><BarChart data={comparisonData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="metric"/><YAxis domain={[0,100]}/><Tooltip/><Legend/><Bar dataKey="Baseline" fill="currentColor" opacity={.35}/><Bar dataKey="Candidate" fill="currentColor" opacity={.9}/></BarChart></ResponsiveContainer>
        </article>
        <article className="card policyCard">
          <span className="eyebrow">PHASE 1 RELEASE POLICY</span><h2>Deterministic gate</h2>
          <div className="policyRows">
            <div><span>Critical safety failure</span><b>HOLD</b></div>
            <div><span>Major safety / reliability / correctness regression</span><b>HOLD</b></div>
            <div><span>Performance regression beyond tolerance</span><b>INVESTIGATE</b></div>
            <div><span>Minor adverse trade-off</span><b>INVESTIGATE</b></div>
            <div><span>All constraints satisfied</span><b>SHIP</b></div>
          </div>
          <p className="policyNote">Default tolerances: helpfulness −2 pts · safety −1 pt · reliability −2 pts · code pass −2 pts · latency +5%.</p>
        </article>
      </section>

      <section id="failures" className="card">
        <div className="sectionHead">
          <div><span className="eyebrow">FAILURE EXPLORER</span><h2>Why did the candidate fail?</h2><p>Individual failures connect directly to release-impact categories.</p></div>
          <div className="filters">
            <div className="search"><Search size={15}/><input placeholder="Search failures" value={query} onChange={e=>setQuery(e.target.value)}/></div>
            <select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="all">All severities</option><option>critical</option><option>high</option><option>medium</option><option>low</option></select>
          </div>
        </div>
        <div className="failureList">
          {failures.slice(0,16).map(f=><details key={f.id}>
            <summary><span><strong>{f.taskId}</strong> · {f.category} · {f.failureType}</span><span className={`severity ${f.severity}`}>{f.severity ?? 'unknown'}</span></summary>
            <div className="failureBody">
              <div><b>Prompt</b><pre>{f.prompt}</pre><b>Expected</b><pre>{f.expectedOutput}</pre></div>
              <div><b>Candidate output</b><pre>{f.actualOutput}</pre><b>Release impact</b><p>{f.category === 'Security' ? 'Contributes to the safety release gate and can block production promotion.' : 'Contributes to candidate reliability and code-quality evidence.'}</p></div>
            </div>
          </details>)}
          {!failures.length&&<p className="empty">No failures match the current filters.</p>}
        </div>
      </section>

      <section id="decision" className={`decision card ${gate.decision.toLowerCase()}`}>
        <div><span className="eyebrow">FINAL RELEASE DECISION</span><h2>{gate.decision}</h2><p>{gate.explanation}</p></div>
        <div className="decisionStats"><div><span>Failures</span><strong>{gate.candidate.failures}</strong></div><div><span>Critical</span><strong>{gate.candidate.criticalFailures}</strong></div><div><span>Quality Δ</span><strong>{(gate.candidate.qualityScore-gate.baseline.qualityScore).toFixed(1)}</strong></div></div>
        <div className="actions"><button onClick={exportReport}><Download size={16}/> Export report</button><button onClick={exportCsv}><Download size={16}/> Export CSV</button></div>
      </section>

      <section id="evidence" className="card docs">
        <ShieldAlert/><div><span className="eyebrow">EVIDENCE CHAIN</span><h2>Reproducible Phase 1 decision</h2><p>Model → Evaluation Dataset → Metrics → Regression Detection → Failure Analysis → Release Policy → <b>SHIP / INVESTIGATE / HOLD</b></p><p>Demo model names and results are fictional and intentionally deterministic. They demonstrate release-engineering methodology, not claims about real model performance.</p><p><a href="https://huggingface.co/datasets/h0000w/model-quality-release-gate" target="_blank" rel="noreferrer">Dataset</a> · <a href="https://huggingface.co/h0000w/model-quality-release-gate" target="_blank" rel="noreferrer">Model card</a> · <a href="https://huggingface.co/spaces/h0000w/model-quality-release-gate" target="_blank" rel="noreferrer">Live Space</a> · <a href="https://hendarmawan.se/model-quality-release-gate/" target="_blank" rel="noreferrer">Portfolio case study</a></p></div>
      </section>
    </main>

    <footer><span>AI Model Release Control Center · Phase 1 · Hendarmawan, PhD Eng.</span><span><a href="https://github.com/h00w">GitHub</a> · <a href="https://www.linkedin.com/in/hender/">LinkedIn</a> · <a href="https://hendarmawan.se">hendarmawan.se</a></span></footer>
  </div>;
}
