import { useMemo, useState } from 'react';
import { Download, FlaskConical, Microscope, RotateCcw, ShieldAlert } from 'lucide-react';
import { assessExperiment, experimentArtifact, illustrativeExperiment, investigationHypotheses, recommendedExperiments } from '../lib/postTraining';
import '../postTraining.css';

function formatValue(value:number, unit:string){
  if(unit==='usd') return `$${value.toFixed(3)}`;
  if(unit==='ms') return `${(value/1000).toFixed(1)}s`;
  if(unit==='tokens') return `${Math.round(value)}`;
  return `${value.toFixed(1)}%`;
}

function formatDelta(delta:number, deltaPercent:number, unit:string){
  if(unit==='usd'||unit==='ms'||unit==='tokens') return `${deltaPercent>=0?'+':''}${deltaPercent.toFixed(1)}%`;
  return `${delta>=0?'+':''}${delta.toFixed(1)} pts`;
}

const initialCandidates=Object.fromEntries(illustrativeExperiment.metrics.map(metric=>[metric.key,metric.candidate])) as Record<string,number>;

export default function PostTrainingExperimentLab(){
  const [candidateValues,setCandidateValues]=useState<Record<string,number>>({...initialCandidates});
  const experiment=useMemo(()=>({...illustrativeExperiment,metrics:illustrativeExperiment.metrics.map(metric=>({...metric,candidate:candidateValues[metric.key]??metric.candidate}))}),[candidateValues]);
  const result=useMemo(()=>assessExperiment(experiment),[experiment]);
  const hypotheses=useMemo(()=>investigationHypotheses(result),[result]);

  function downloadArtifact(){
    const payload=JSON.stringify(experimentArtifact(experiment),null,2);
    const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`post-training-experiment-${experiment.id}.json`;a.click();URL.revokeObjectURL(url);
  }
  const reset=()=>setCandidateValues({...initialCandidates});
  const interpretation=result.decision==='SHIP'
    ? 'The current candidate values remain within configured tolerances and are eligible for the next promotion stage.'
    : result.decision==='HOLD'
      ? 'At least one regression crossed a hard threshold. Promotion should remain blocked until remediation and re-evaluation.'
      : 'The candidate has promising gains, but at least one release dimension requires causal investigation before promotion.';

  return <section id="post-training" className="card postTrainingLab">
    <div className="sectionHead postTrainingHead"><div><span className="eyebrow">POST-TRAINING EXPERIMENT LAB · RESEARCH ENGINEERING</span><h2>Did the training intervention actually make the model better?</h2><p>Edit candidate metrics to run a lightweight counterfactual experiment. The release decision and investigation priorities recompute from the same policy logic.</p></div><div className="labActions"><button className="textBtn" onClick={reset}><RotateCcw size={16}/> Reset</button><button className="textBtn" onClick={downloadArtifact}><Download size={16}/> Export experiment JSON</button></div></div>

    <div className="experimentMeta">
      <div><span>Baseline</span><strong>{experiment.baseline}</strong></div>
      <div><span>Candidate</span><strong>{experiment.candidate}</strong></div>
      <div><span>Training intervention</span><strong>{experiment.intervention}</strong></div>
      <div><span>Dataset</span><strong>{experiment.datasetSize.toLocaleString()} coding tasks</strong></div>
      <div><span>Evaluation set</span><strong>{experiment.evaluationSet}</strong></div>
    </div>
    <p className="experimentNote">{experiment.note} Candidate values below are editable; hypotheses are prioritized from observed regression classes, not presented as causal conclusions.</p>

    <div className="experimentTableWrap"><div className="experimentTable">
      <div className="experimentRow experimentHeader"><span>Evaluation</span><span>Baseline</span><span>Candidate</span><span>Δ</span><span>Signal</span></div>
      {result.metrics.map(metric=><div className="experimentRow" key={metric.key}><span><b>{metric.label}</b><small>{metric.group}</small></span><span>{formatValue(metric.baseline,metric.unit)}</span><span><input className="experimentInput" aria-label={`${metric.label} candidate value`} type="number" step={metric.unit==='usd'?0.001:metric.unit==='ms'?10:metric.unit==='tokens'?1:0.1} value={candidateValues[metric.key]} onChange={e=>setCandidateValues(values=>({...values,[metric.key]:Number(e.target.value)}))}/><small>{metric.unit==='%'?'%':metric.unit==='ms'?'ms':metric.unit==='usd'?'USD':'tokens'}</small></span><span className={metric.status==='IMPROVED'?'expGood':metric.status==='REGRESSION'||metric.status==='CRITICAL'?'expBad':''}>{formatDelta(metric.delta,metric.deltaPercent,metric.unit)}</span><span className={`experimentStatus ${metric.status.toLowerCase()}`}>{metric.status}</span></div>)}
    </div></div>

    <div className={`experimentDecision ${result.decision.toLowerCase()}`}><div><span className="eyebrow">RELEASE DECISION</span><h3>{result.decision}</h3><p>{result.explanation}</p><blockquote>{interpretation}</blockquote></div><FlaskConical/></div>

    <div className="researchQuestion"><Microscope/><div><span className="eyebrow">WHAT WOULD I INVESTIGATE?</span><h3>Do not stop at the metric delta. Ask what causal mechanism could have produced the observed regression.</h3></div></div>

    <div className="postTrainingGrid">
      <article className="hypothesisPanel"><div className="miniTitle"><ShieldAlert size={17}/><div><strong>Potential causes</strong><small>Prioritized hypotheses, not conclusions</small></div></div><div className="hypothesisList">{hypotheses.map((h,index)=><details key={h.id}><summary><span className="hypothesisRank">{String(index+1).padStart(2,'0')}</span><span className="hypothesisName">{h.label}</span><span className="hypothesisBar"><i style={{width:`${h.strength}%`}}/></span><b>{h.strength}</b></summary><p>{h.rationale}</p></details>)}</div></article>
      <article className="recommendedPanel"><div className="miniTitle"><FlaskConical size={17}/><div><strong>Recommended experiments</strong><small>Tests designed to falsify the leading hypotheses</small></div></div><ol>{recommendedExperiments.map(item=><li key={item}>{item}</li>)}</ol></article>
    </div>

    <div className="researchLoop"><span>TRAIN</span><b>→</b><span>EVALUATE</span><b>→</b><span>COMPARE</span><b>→</b><span>INVESTIGATE</span><b>→</b><span>GATE</span><b>→</b><span>SHIP</span><b>→</b><span>MONITOR</span><b>→</b><span>LEARN</span></div>
  </section>;
}
