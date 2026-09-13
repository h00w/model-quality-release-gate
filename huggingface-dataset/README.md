---
license: mit
task_categories:
- text-generation
language:
- en
tags:
- code-generation
- llm-evaluation
- release-gating
- ai-safety
pretty_name: Model Quality Release Gate Evaluation Dataset
---

# Model Quality Release Gate Evaluation Dataset

Reproducible evaluation evidence for comparing baseline and candidate AI code-generation models before release.

Phase 3 introduces explicit benchmark versioning so release evidence can identify exactly which dataset definition produced a decision.

## Versioned benchmark

Current benchmark release:

- **Name:** `CodeBench-Safety`
- **Version:** `1.0.0`
- **Manifest:** `versions/v1.0.0/manifest.json`
- **Cases:** `versions/v1.0.0/cases.jsonl`
- **Compatible policy:** `release-policy/v1.0.0`

Benchmark definitions are versioned independently from model outputs. A future benchmark change therefore creates a new dataset version instead of silently changing historical release semantics.

## Evaluation-result schema

The demonstration result file under `data/evaluation_cases.jsonl` contains:

`task_id`, `category`, `prompt`, `expected`, `model`, `helpfulness`, `safety`, `reliability`, `latency_ms`, `code_pass_rate`, `passed`, `failure_type`, `severity`.

Scores are normalized to `0..1`; latency is milliseconds.

## Evidence chain

Source: https://github.com/h00w/model-quality-release-gate  
Space: https://huggingface.co/spaces/h0000w/model-quality-release-gate  
Methodology card: https://huggingface.co/h0000w/model-quality-release-gate  
Portfolio: https://hendarmawan.se/projects/model-quality-release-gate/
