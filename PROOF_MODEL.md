# Production AI Five-Level Proof Model v1

"Reproducible" is a necessary proof state, not the final claim.

This model turns production-AI evidence into five cumulative levels. A system may claim only the highest level for which every lower level and every level-specific requirement is satisfied.

| Level | Name | Minimum proof |
|---|---|---|
| 1 | **Runnable** | The pinned source executes its configured verification entry point in a declared runtime and produces an explicit result. |
| 2 | **Reproducible** | A clean checkout passes `make reproduce`; Production AI Evidence Contract v1 records source/runtime identity, dependency/input/benchmark/policy digests, retained logs, and checksums. |
| 3 | **Capability-Validated** | Level 2 plus a versioned benchmark and independently inspectable public capability evidence (for example a Hugging Face Dataset/Space or another hosted reviewer surface) tied to the same engineering claim. |
| 4 | **Production-Candidate** | Level 3 plus an explicit release-candidate package, deterministic release policy, machine-readable decision, and the project-specific operational/security/approval evidence required before deployment. |
| 5 | **Production-Validated** | Level 4 plus evidence from the target operational environment over a defined observation window, including SLO/telemetry evidence and demonstrated rollback, recovery, or incident handling. |

## Non-negotiable rules

1. **Levels are cumulative.** Level 4 cannot exist without Levels 1-3.
2. **Execution success is not release authorization.** Reproduction status and release state remain separate.
3. **Public demos are evidence, not production proof.** A Space or Streamlit app can support Level 3 but cannot by itself establish Levels 4-5.
4. **Synthetic benchmarks must say they are synthetic.** They may validate engineering capability without implying real-world population validity.
5. **Level 5 is time- and environment-bounded.** It must identify the operational scope, observation window, and recovery evidence.
6. **No silent promotion.** `scripts/proof_level.py` computes the highest level supported by the configured evidence and records why higher levels are not established.

## Commands

```bash
make proof          # reproduce + online public-evidence verification + proof assessment
make proof-offline  # reproduce + Levels 1-2 only; no network-backed Level 3 assertion
```

Generated proof artifacts are written beside the Evidence Contract bundle:

```text
evidence/out/current/
├── evidence.json
├── proof.json
├── proof-summary.md
├── verification.stdout.log
├── verification.stderr.log
└── checksums.sha256
```

The canonical machine-readable level definition is `evidence/production-ai-proof-model-v1.json`.


## L5 admission contract

**L5 Production-Validated is now governed by [Deployment Evidence & Production Observation Contract v1](DEPLOYMENT_EVIDENCE.md).**

A repository setting `maxLevel: 5` is only declaring an eligible ceiling. The achieved level remains L4 or below until `scripts/proof_level.py` receives a governed `evidence/deployment-evidence.json` for the exact checked-out subject and the contract validator confirms all of the following:

- exact deployment and source/artifact identity;
- operational environment fingerprint;
- bounded real-traffic observation window;
- telemetry provenance and retained evidence digests;
- all declared blocking SLOs pass;
- rollback/recovery drill passes its objective;
- incident state is explicit and closed/accepted where incidents occurred;
- cryptographic linkage to the L4 proof/release evidence;
- bounded scope, exclusions and accountable approval.

A missing, synthetic, stale, unbounded or failed observation therefore leaves the project at L4 or below. Cryptographic signing does not override this gate.
