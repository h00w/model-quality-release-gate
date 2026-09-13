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

Reproducible evaluation cases for comparing baseline and candidate AI code-generation models before release.

Each record contains a task, category, expected properties, quality dimensions, latency, pass/fail state, failure type and severity. The dataset is designed to demonstrate multidimensional model evaluation and deterministic **SHIP / INVESTIGATE / HOLD** release policy.

Source: https://github.com/h00w/model-quality-release-gate  
Space: https://huggingface.co/spaces/h0000w/model-quality-release-gate  
Model card: https://huggingface.co/h0000w/model-quality-release-gate

## Schema

`task_id`, `category`, `prompt`, `expected`, `model`, `helpfulness`, `safety`, `reliability`, `latency_ms`, `code_pass_rate`, `passed`, `failure_type`, `severity`.

Scores are normalized to `0..1`; latency is milliseconds.
