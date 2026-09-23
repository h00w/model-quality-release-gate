"""Self-test the L5 deployment evidence validator with positive and negative fixtures."""

from __future__ import annotations

import copy
import json

from validate_deployment_evidence import assess_deployment_evidence

COMMIT = "1" * 40
DIGEST = "2" * 64


def fixture() -> dict:
    return {
        "schemaVersion": "1.0.0",
        "subject": {
            "repository": "h00w/example",
            "commit": COMMIT,
            "artifact": {"name": "candidate", "version": "1.0.0", "sha256": DIGEST},
        },
        "deployment": {
            "deploymentId": "prod-001",
            "environment": {
                "id": "prod-eu-1",
                "class": "controlled-production",
                "region": "eu",
                "tenantScope": "bounded-canary",
            },
            "startedAt": "2026-09-20T00:00:00Z",
            "environmentFingerprint": {
                "sha256": DIGEST,
                "components": [{"name": "runtime", "identity": "image@sha256:abc", "sha256": None}],
            },
        },
        "observation": {
            "trafficClass": "operational-real",
            "window": {
                "start": "2026-09-20T00:00:00Z",
                "end": "2026-09-20T01:00:00Z",
                "durationSeconds": 3600,
            },
            "sampleCount": 100,
            "telemetry": {
                "system": "otel",
                "sourceRef": "retained://observation/1",
                "exportSha256": DIGEST,
                "querySha256": DIGEST,
                "collectorVersion": "1.0",
                "redactionApplied": True,
                "retentionClass": "engineering-evidence",
            },
            "slos": [
                {
                    "id": "availability",
                    "metric": "success_rate",
                    "operator": ">=",
                    "target": 0.99,
                    "observed": 0.995,
                    "unit": "ratio",
                    "passed": True,
                    "evidenceSha256": DIGEST,
                }
            ],
        },
        "rollback": {
            "demonstrated": True,
            "drillId": "rollback-001",
            "startedAt": "2026-09-20T00:30:00Z",
            "completedAt": "2026-09-20T00:31:00Z",
            "recoveryTimeSeconds": 60,
            "objectiveSeconds": 600,
            "outcome": "PASS",
            "evidenceSha256": DIGEST,
        },
        "incidents": {"noneObserved": True, "records": []},
        "linkage": {
            "l4ProofBundleSha256": DIGEST,
            "releaseBindingSha256": DIGEST,
            "sourceCommit": COMMIT,
            "attestationUrls": ["https://github.com/h00w/example/attestations/1"],
        },
        "boundedClaim": {
            "status": "PRODUCTION_VALIDATED",
            "environmentId": "prod-eu-1",
            "observationStart": "2026-09-20T00:00:00Z",
            "observationEnd": "2026-09-20T01:00:00Z",
            "scope": "Bounded controlled-production canary for the named artifact and environment.",
            "exclusions": ["No claim beyond the named environment and observation window."],
            "statement": "The named deployment satisfied the declared SLO and rollback evidence during the recorded observation window.",
            "approvals": [
                {
                    "role": "release-owner",
                    "identity": "test-reviewer",
                    "approvedAt": "2026-09-20T01:05:00Z",
                }
            ],
        },
    }


def expect(payload: dict, qualified: bool, label: str) -> None:
    result = assess_deployment_evidence(
        payload,
        expected_commit=COMMIT,
        minimum_observation_seconds=3600,
    )
    if result["qualified"] is not qualified:
        raise SystemExit(f"{label}: unexpected result: {json.dumps(result, indent=2)}")


def main() -> int:
    base = fixture()
    expect(base, True, "positive fixture")

    bad_slo = copy.deepcopy(base)
    bad_slo["observation"]["slos"][0]["observed"] = 0.8
    bad_slo["observation"]["slos"][0]["passed"] = False
    expect(bad_slo, False, "failed SLO")

    bad_rollback = copy.deepcopy(base)
    bad_rollback["rollback"]["recoveryTimeSeconds"] = 700
    expect(bad_rollback, False, "rollback objective miss")

    wrong_commit = copy.deepcopy(base)
    wrong_commit["subject"]["commit"] = "3" * 40
    wrong_commit["linkage"]["sourceCommit"] = "3" * 40
    expect(wrong_commit, False, "wrong deployed source")

    synthetic = copy.deepcopy(base)
    synthetic["observation"]["trafficClass"] = "synthetic"
    expect(synthetic, False, "synthetic traffic")

    unbounded = copy.deepcopy(base)
    unbounded["boundedClaim"]["exclusions"] = []
    expect(unbounded, False, "unbounded claim")

    print("PASS: deployment evidence validator accepted the qualified fixture.")
    print("PASS: failed SLO, rollback miss, wrong source, synthetic traffic, and unbounded claim were rejected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
