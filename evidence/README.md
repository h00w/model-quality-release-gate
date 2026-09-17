# Production AI Evidence Contract v1

This repository is the canonical source of the **Production AI Evidence Contract v1** used across the flagship Production AI portfolio.

The contract binds a reproduction result to:

- exact Git source identity;
- runtime and dependency identity;
- benchmark and input file digests;
- release/policy file digests;
- deterministic verification command and retained logs;
- approval requirements;
- explicit reproduction status;
- provenance; and
- SHA-256 checksums for generated evidence artifacts.

Canonical schema:

`evidence/production-ai-evidence-contract-v1.schema.json`

Schema SHA-256:

`4606849e4a5d6e2919cffd246f8378316012676c5a503331c29bc9fdb98a0043`

## Important semantic boundary

`make reproduce` produces a **reproduction PASS/FAIL**. A PASS means the configured verification chain completed successfully for the recorded source and environment. It does **not** imply `SHIP`, `approved`, production validation, safety certification, or deployment authorization.

Domain-specific release state can be attached separately under `decision.releaseState` only when the underlying project has produced that evidence.
