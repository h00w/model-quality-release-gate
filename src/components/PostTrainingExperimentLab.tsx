import { Download, FlaskConical, Microscope, ShieldAlert } from 'lucide-react';
import { assessExperiment, experimentArtifact, illustrativeExperiment, investigationHypotheses, recommendedExperiments } from '../lib/postTraining';

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

function downloadArtifact(){
  const payload=JSON.stringify(experimentArtifact(illustrativeExperiment),null,2);
  const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='post-training-experiment-exp-sft-001.json';a.click();URL.revokeObjectURL(url);
}

export default function PostTrainingExperimentLab(){
  const result=assessExperiment(illustrativeExperiment);
  const hypotheses=investigationHypotheses(result);
  return <section id="post-training" className="card postTrainingLab">
    <div className="sectionHead postTrainingHead"><div><span className="eyebrow">POST-TRAINING EXPERIMENT LAB · RESEARCH ENGINEERING</span><h2>Did the training intervention actually make the model better?</h2><p>Connect post-training changes to release evidence, then investigate *why* an apparently stronger model may still be unsafe or uneconomical to ship.</p></div><button className="textBtn" onClick={downloadArtifact}><Download size={16}/> Export experiment JSON</button></div>

    <div className="experimentMeta">
      <div><span>Baseline</span><strong>{illustrativeExperiment.baseline}</strong></div>
      <div><span>Candidate</span><strong>{illustrativeExperiment.candidate}</strong></div>
      <div><span>Training intervention</span><strong>{illustrativeExperiment.intervention}</strong></div>
      <div><span>Dataset</span><strong>{illustrativeExperiment.datasetSize.toLocaleString()} coding tasks</strong></div>
      <div><span>Evaluation set</span><strong>{illustrativeExperiment.evaluationSet}</strong></div>
    </div>
    <p className="experimentNote">{illustrativeExperiment.note}</p>

    <div className="experimentTableWrap"><div className="experimentTable">
      <div className="experimentRow experimentHeader"><span>Evaluation</span><span>Baseline</span><span>Candidate</span><span>Δ</span><span>Signal</span></div>
      {result.metrics.map(metric=><div className="experimentRow" key={metric.key}><span><b>{metric.label}</b><small>{metric.group}</small></span><span>{formatValue(metric.baseline,metric.unit)}</span><span>{formatValue(metric.candidate,metric.unit)}</span><span className={metric.status==='IMPROVED'?'expGood':metric.status==='REGRESSION'||metric.status==='CRITICAL'?'expBad':''}>{formatDelta(metric.delta,metric.deltaPercent,metric.unit)}</span><span className={`experimentStatus ${metric.status.toLowerCase()}`}>{metric.status}</span></div>)}
    </div></div>

    <div className={`experimentDecision ${result.decision.toLowerCase()}`}><div><span className="eyebrow">RELEASE DECISION</span><h3>{result.decision}</h3><p>{result.explanation}</p><blockquote>Code quality improved significantly, but safety, latency and efficiency moved adversely enough to require root-cause investigation before promotion.</blockquote></div><FlaskConical/></div>

    <div className="researchQuestion"><Microscope/><div><span className="eyebrow">WHAT WOULD I INVESTIGATE?</span><h3>Do not stop at “Safety decreased 1.3 points.” Ask what causal mechanism produced the regression.</h3></div></div>

    <div className="postTrainingGrid">
      <article className="hypothesisPanel"><div className="miniTitle"><ShieldAlert size={17}/><div><strong>Potential causes</strong><small>Prioritized hypotheses, not conclusions</small></div></div><div className="hypothesisList">{hypotheses.map((h,index)=><details key={h.id}><summary><span className="hypothesisRank">{String(index+1).padStart(2,'0')}</span><span className="hypothesisName">{h.label}</span><span className="hypothesisBar"><i style={{width:`${h.strength}%`}}/></span><b>{h.strength}</b></summary><p>{h.rationale}</p></details>)}</div></article>
      <article className="recommendedPanel"><div className="miniTitle"><FlaskConical size={17}/><div><strong>Recommended experiments</strong><small>Tests designed to falsify the leading hypotheses</small></div></div><ol>{recommendedExperiments.map(item=><li key={item}>{item}</li>)}</ol></article>
    </div>

    <div className="researchLoop"><span>TRAIN</span><b>→</b><span>EVALUATE</span><b>→</b><span>COMPARE</span><b>→</b><span>INVESTIGATE</span><b>→</b><span>GATE</span><b>→</b><span>SHIP</span><b>→</b><span>MONITOR</span><b>→</b><span>LEARN</span></div>
  </section>;
}
