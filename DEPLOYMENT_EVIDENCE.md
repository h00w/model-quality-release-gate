# Deployment Evidence & Production Observation Contract v1

Step 5 defines the **only admissible evidence path from L4 Production-Candidate to L5 Production-Validated**.

It does not make any current flagship L5. It defines what a future L5 claim must prove.

## Required evidence

### 1. Deployment identity

The evidence must identify the exact deployed subject:

- repository and 40-character source commit;
- deployed artifact name and version;
- deployed artifact SHA-256;
- deployment ID;
- operational environment ID and class.

### 2. Environment fingerprint

A production-validation claim must be bound to a concrete environment. Record a fingerprint plus the material runtime/configuration identities that make the observation reproducible enough to interpret.

Do not put secrets in the contract. Hash or reference sensitive configuration.

### 3. Bounded observation window

L5 is never an indefinite statement.

The contract records:

- start and end timestamps;
- exact duration;
- operational-real traffic only;
- sample count;
- a project-specific minimum observation duration.

Synthetic benchmarks, demo traffic, and offline evaluation cannot satisfy this requirement.

### 4. Telemetry provenance

Raw production data does not have to be committed to Git.

The contract stores:

- telemetry system;
- governed source reference;
- export SHA-256;
- optional query SHA-256;
- collector version;
- whether redaction was applied;
- retention classification.

This lets the production claim point to retained evidence without turning a public repository into a telemetry or personal-data store.

### 5. SLO evidence

Every SLO used for L5 must record:

- metric;
- operator;
- target;
- observed value;
- unit;
- computed PASS/FAIL;
- evidence digest.

All declared blocking SLOs must pass. The validator recomputes the comparison instead of trusting the supplied boolean.

### 6. Rollback or recovery drill

L5 requires demonstrated recovery capability.

The contract requires a real exercise with:

- drill ID;
- start and completion time;
- recovery time;
- objective;
- PASS outcome;
- retained evidence digest.

A system that has never demonstrated recovery cannot be L5 under this model.

### 7. Incident and recovery evidence

The observation must explicitly state either:

- no incidents were observed; or
- one or more incident records exist and each has an acceptable terminal state plus recovery evidence.

Silence is not equivalent to zero incidents.

### 8. Cryptographic linkage back to L4

Deployment evidence must reference:

- the signed L4 proof-bundle SHA-256;
- release-binding SHA-256;
- source commit;
- one or more attestation URLs.

This prevents production telemetry from being reused to validate a different candidate.

### 9. Bounded production-validation claim

The final statement must identify:

- the exact environment;
- exact observation window;
- scope;
- explicit exclusions;
- human approval records.

The intended wording is deliberately narrow:

> The named deployment satisfied the declared production-observation contract in the named environment during the recorded observation window.

It does **not** imply universal safety, future performance, all-user validity, or fitness outside that scope.

## Commands

Run the validator self-test:

```bash
make deployment-contract-selftest
```

The committed example is intentionally **not** L5 evidence:

```bash
make deployment-template-check
```

When real governed operational evidence exists, create `evidence/deployment-evidence.json` and run:

```bash
make deployment-evidence-check
```

Only after the evidence passes should a project explicitly change its proof policy to:

```json
{
  "maxLevel": 5,
  "level5": {
    "enabled": true,
    "deploymentEvidencePath": "evidence/deployment-evidence.json",
    "minimumObservationSeconds": 86400
  }
}
```

The observation minimum is project policy, not a universal constant.

## Privacy and security

Do not commit production prompts, personal data, secrets, customer payloads, API tokens, raw incident logs, or confidential telemetry solely to satisfy this contract.

Use governed references and cryptographic digests. The proof is about evidence identity and decision integrity, not public disclosure of sensitive operational data.
