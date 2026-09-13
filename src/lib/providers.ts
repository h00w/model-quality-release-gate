import type { EvaluationResult } from '../types/evaluation';
import { validateEvaluation } from './evaluation';

export interface EvaluationProvider { id:string; label:string; loadEvaluation():Promise<EvaluationResult[]>; }

export class StaticEvaluationProvider implements EvaluationProvider {
  id='static'; label='Imported / local evaluation';
  constructor(private readonly rows:EvaluationResult[]){}
  async loadEvaluation(){validateEvaluation(this.rows);return this.rows;}
}

export class HttpEvaluationProvider implements EvaluationProvider {
  id='http'; label='Remote evaluation API';
  constructor(private readonly endpoint:string){}
  async loadEvaluation():Promise<EvaluationResult[]>{
    const response=await fetch(this.endpoint,{headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`Evaluation provider returned HTTP ${response.status}.`);
    const payload=await response.json();
    const rows=Array.isArray(payload)?payload:payload.results;
    if(!Array.isArray(rows))throw new Error('Evaluation provider response must be an array or { results: [] }.');
    validateEvaluation(rows);return rows;
  }
}

// Real model/API execution belongs server-side (for example the Hugging Face Space)
// so tokens never ship in the static browser bundle. The browser consumes normalized
// EvaluationResult records and applies the same deterministic release-gate policy.
