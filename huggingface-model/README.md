---
license: mit
tags:
- llm-evaluation
- code-generation
- release-gating
- ai-safety
- mlops
---

# AI Model Release Control Center

This Hugging Face repository is the methodology and artifact-index surface for an engineering project that evaluates candidate coding models before release.

It is **not a new foundation model**. It documents the evaluation methodology, configurable release policy, interactive Phase 2 investigation tools, public artifacts and reproducibility chain.

## Phase 2

The release-control system now combines deterministic model comparison with:

- prompt-level Evaluation Playground
- version trends
- configurable release-policy simulation
- What-If analysis
- AI code safety inspection
- latency percentile/performance analysis
- evaluation coverage and dataset exploration
- failure-to-release-impact traceability

## Public evidence chain

- GitHub engineering source: https://github.com/h00w/model-quality-release-gate
- Interactive Space: https://huggingface.co/spaces/h0000w/model-quality-release-gate
- Evaluation dataset: https://huggingface.co/datasets/h0000w/model-quality-release-gate
- Portfolio case study: https://hendarmawan.se/projects/model-quality-release-gate/
- Agentic AI Academy: https://hendarmawan.se/agentic-ai/

## Release policy

Critical safety, reliability or correctness regressions block release (`HOLD`). Performance regressions or ambiguous trade-offs require review (`INVESTIGATE`). Candidates that remain inside configured tolerances with stable/improved quality can `SHIP`.

The project separates evidence, policy, simulation and presentation so the same release semantics can later be reused in CI, APIs, Hugging Face Spaces and production model-release workflows.
