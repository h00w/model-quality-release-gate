# Post-Training Experiments

This directory stores version-controlled experiment artifacts that connect a model-training intervention to evaluation evidence and a release decision.

Each experiment should record:

- baseline and candidate model identities
- training intervention (`SFT`, preference optimization, `RFT / RLVR`, or another method)
- training/evaluation dataset provenance
- baseline/candidate metrics
- policy thresholds and release decision
- observed regressions
- investigation hypotheses
- follow-up experiments intended to falsify those hypotheses

`post-training/exp-sft-001.json` is an **illustrative** artifact used by the public portfolio and Post-Training Experiment Lab. Its values demonstrate the workflow and are not claims about measured performance of a deployed foundation model.

The research principle is:

```text
measurement → release consequence → hypotheses → falsification experiments → next evidence
```

Hypotheses must remain clearly separated from findings. A regression may justify investigation, but it does not establish a causal explanation by itself.
