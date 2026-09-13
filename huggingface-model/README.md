---
license: mit
tags:
- llm-evaluation
- code-generation
- release-gating
- ai-safety
- mlops
---

# Model Quality Release Gate for AI Code Generation

This repository is the Hugging Face model-card/publication surface for an engineering project that evaluates candidate coding models before release.

It is **not a new foundation model**. It documents the evaluation methodology, release policy, public artifacts and reproducibility chain.

## Public evidence chain

- GitHub engineering source: https://github.com/h00w/model-quality-release-gate
- Interactive Space: https://huggingface.co/spaces/h0000w/model-quality-release-gate
- Evaluation dataset: https://huggingface.co/datasets/h0000w/model-quality-release-gate
- Portfolio case study: https://hendarmawan.se/model-quality-release-gate/
- Agentic AI Academy: https://hendarmawan.se/agentic-ai/

## Release policy

Critical safety, reliability or correctness regressions block release (`HOLD`). Performance regressions or ambiguous trade-offs require review (`INVESTIGATE`). Candidates that remain inside configured tolerances with stable/improved quality can `SHIP`.

The project separates evaluation evidence from UI presentation so the same gate can be reused in CI, APIs, Hugging Face Spaces and production model-release workflows.
