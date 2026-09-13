---
title: AI Model Release Control Center
emoji: 🚦
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 5.49.1
app_file: app.py
pinned: true
license: mit
---

# AI Model Release Control Center

**Train → Evaluate → Compare → Investigate → Gate → Ship → Monitor → Learn**

A production-oriented AI evaluation and release-engineering workbench focused on the interface between **post-training and production**.

## Post-Training Experiment Lab

The first tab demonstrates a research-engineering workflow for deciding whether a training intervention actually improved the model.

Illustrative experiment:

- baseline: `CodeModel-v1`
- candidate: `CodeModel-v2-sft`
- intervention: `SFT`
- dataset: `10,000 coding tasks`
- result: quality improves, while safety, latency, cost and token efficiency regress
- release decision: **INVESTIGATE**

The Lab then asks **why**: it ranks causal hypotheses separately from findings and proposes follow-up experiments designed to falsify those hypotheses.

The values are explicitly illustrative and are not presented as real benchmark claims.

## Production evaluation capabilities

- Post-Training Experiment Lab
- deterministic reference SHIP / INVESTIGATE / HOLD gate
- server-side Hugging Face model inference
- deterministic safety and task-aware correctness checks
- optional advisory LLM judge
- prompt/output provenance hashes
- production-trace ingestion
- evidence-linked model promotion semantics
- public versioned benchmark and release artifacts

Generated code is not executed inside the Space process. Real executable-code evaluation belongs behind an isolated sandbox/worker boundary.

## Runtime secret

Live Hugging Face inference requires `HF_TOKEN` configured in **Space Settings → Secrets**. The GitHub Actions token used to publish this Space does not automatically become a Space runtime secret.

## Public evidence chain

- Source: https://github.com/h00w/model-quality-release-gate
- Methodology: https://huggingface.co/h0000w/model-quality-release-gate
- Dataset: https://huggingface.co/datasets/h0000w/model-quality-release-gate
- Space: https://huggingface.co/spaces/h0000w/model-quality-release-gate
- Portfolio case study: https://hendarmawan.se/projects/model-quality-release-gate/
- Agentic AI Academy: https://hendarmawan.se/agentic-ai/
