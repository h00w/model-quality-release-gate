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

The reproduction tool calculates the SHA-256 of the **local schema bytes at runtime** and records it in `extensions.schemaSha256`. This prevents documentation from becoming the authority for a stale schema digest.

## Important semantic boundary

`make reproduce` produces a **reproduction PASS/FAIL**. A PASS means the configured verification chain completed successfully for the recorded source and environment. It does **not** imply `SHIP`, `approved`, production validation, safety certification, or deployment authorization.

Domain-specific release state can be attached separately under `decision.releaseState` only when the underlying project has produced that evidence.
