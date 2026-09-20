---
license: mit
tags:
- llm-evaluation
- code-generation
- release-gating
- ai-safety
- mlops
- post-training
---

# AI Model Release Control Center

This repository is the methodology and artifact-index surface for a research-engineering project focused on the **post-training → evaluation → production** interface.

It is **not a foundation model**. It documents how training interventions, baseline/candidate experiments, deterministic evaluation, CI release policy, live-provider evidence, production traces and model promotion fit into one lifecycle.

> **Train → Evaluate → Compare → Investigate → Gate → Ship → Monitor → Learn**

## Post-Training Experiment Lab

The Lab represents each intervention as an explicit experiment with:

- baseline and candidate model identities
- training intervention (for example SFT, preference optimization or RFT/RLVR)
- dataset and evaluation-set provenance
- multi-objective metrics across code quality, correctness, instruction following, hallucination, safety, latency, cost and token efficiency
- release decision: `SHIP`, `INVESTIGATE` or `HOLD`
- ranked causal hypotheses
- follow-up experiments intended to falsify those hypotheses
- machine-readable experiment artifact

The default `CodeModel-v1 → CodeModel-v2-sft` results are **illustrative**. They demonstrate the investigation workflow without making unsupported benchmark claims.

## Research principle

A regression number is an observation, not a root cause. The project therefore separates:

```text
measurement → release consequence → hypotheses → follow-up experiments
```

For example, a safety regression after SFT may motivate investigation of training-data distribution shift, conflicting supervision, objective overspecialization, output-length changes or serving configuration. Reward-model bias is considered only when a preference/reward stage actually exists.

## Production release methodology

Critical deterministic safety/correctness failures remain authoritative. Performance, cost or ambiguous quality trade-offs trigger investigation. Optional LLM judging contributes subjective evidence but cannot overrule deterministic critical failures.

The system also provides:

- tamper-evident Phase 3 release bundles
- CI enforcement
- versioned benchmark datasets
- live Hugging Face provider evaluation
- production-trace ingestion
- evidence-linked model lifecycle transitions

## Public evidence chain

- GitHub engineering source: https://github.com/h00w/model-quality-release-gate
- Interactive Space: https://huggingface.co/spaces/h0000w/model-quality-release-gate
- Evaluation dataset: https://huggingface.co/datasets/h0000w/model-quality-release-gate
- Portfolio case study: https://hendarmawan.se/projects/model-quality-release-gate/
- Agentic AI Academy: https://hendarmawan.se/agentic-ai/


## Five-level production-AI proof

This project uses the **Production AI Five-Level Proof Model v1**:

`L1 Runnable → L2 Reproducible → L3 Capability-Validated → L4 Production-Candidate → L5 Production-Validated`.

The canonical engineering source computes the level with `make proof` and records the result in a machine-readable `proof.json`. The configured ceiling for this release-control project is **L4**. L5 is not claimed without target-production observation, SLO and recovery evidence.

Canonical specification: https://github.com/h00w/model-quality-release-gate/blob/main/PROOF_MODEL.md
