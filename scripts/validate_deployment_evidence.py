"""Validate Production AI Deployment Evidence & Observation Contract v1."""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
from datetime import datetime

HEX40 = re.compile(r"^[0-9a-f]{40}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def parse_time(value: str, field: str, errors: list[str]) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError, AttributeError):
        errors.append(f"invalid_datetime:{field}")
        return None


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def require_hex(value: object, pattern: re.Pattern[str], field: str, errors: list[str]) -> None:
    if not isinstance(value, str) or not pattern.fullmatch(value):
        errors.append(f"invalid_digest:{field}")


def compare(operator: str, observed: float, target: float) -> bool:
    return {
        "<": observed < target,
        "<=": observed <= target,
        ">": observed > target,
        ">=": observed >= target,
        "==": observed == target,
    }[operator]


def assess_deployment_evidence(
    payload: dict,
    *,
    expected_commit: str | None = None,
    minimum_observation_seconds: int = 1,
) -> dict:
    errors: list[str] = []
    warnings: list[str] = []

    if payload.get("schemaVersion") != "1.0.0":
        errors.append("schemaVersion_must_be_1.0.0")

    subject = payload.get("subject", {})
    repository = subject.get("repository")
    commit = subject.get("commit")
    if not repository:
        errors.append("missing:subject.repository")
    require_hex(commit, HEX40, "subject.commit", errors)
    if expected_commit and commit != expected_commit:
        errors.append("subject_commit_does_not_match_current_proof_subject")

    artifact = subject.get("artifact", {})
    for key in ("name", "version"):
        if not artifact.get(key):
            errors.append(f"missing:subject.artifact.{key}")
    require_hex(artifact.get("sha256"), HEX64, "subject.artifact.sha256", errors)

    deployment = payload.get("deployment", {})
    if not deployment.get("deploymentId"):
        errors.append("missing:deployment.deploymentId")
    environment = deployment.get("environment", {})
    environment_id = environment.get("id")
    if not environment_id:
        errors.append("missing:deployment.environment.id")
    if environment.get("class") not in {
        "production",
        "target-operational",
        "controlled-production",
    }:
        errors.append("deployment.environment.class_not_operational")
    parse_time(deployment.get("startedAt"), "deployment.startedAt", errors)

    fingerprint = deployment.get("environmentFingerprint", {})
    require_hex(
        fingerprint.get("sha256"),
        HEX64,
        "deployment.environmentFingerprint.sha256",
        errors,
    )
    if not fingerprint.get("components"):
        errors.append("deployment_environment_fingerprint_components_required")

    observation = payload.get("observation", {})
    if observation.get("trafficClass") != "operational-real":
        errors.append("observation_traffic_must_be_operational_real")
    if not isinstance(observation.get("sampleCount"), int) or observation.get("sampleCount", 0) < 1:
        errors.append("observation_sampleCount_must_be_positive")

    window = observation.get("window", {})
    start = parse_time(window.get("start"), "observation.window.start", errors)
    end = parse_time(window.get("end"), "observation.window.end", errors)
    duration = window.get("durationSeconds")
    if not isinstance(duration, int) or duration < minimum_observation_seconds:
        errors.append(
            f"observation_window_below_policy_minimum:{minimum_observation_seconds}"
        )
    if start and end:
        actual = int((end - start).total_seconds())
        if actual <= 0:
            errors.append("observation_window_end_must_follow_start")
        elif duration != actual:
            errors.append("observation_duration_does_not_match_timestamps")

    telemetry = observation.get("telemetry", {})
    for key in ("system", "sourceRef", "collectorVersion", "retentionClass"):
        if not telemetry.get(key):
            errors.append(f"missing:observation.telemetry.{key}")
    require_hex(
        telemetry.get("exportSha256"),
        HEX64,
        "observation.telemetry.exportSha256",
        errors,
    )
    query_sha = telemetry.get("querySha256")
    if query_sha is not None:
        require_hex(
            query_sha,
            HEX64,
            "observation.telemetry.querySha256",
            errors,
        )
    if telemetry.get("redactionApplied") is not True:
        warnings.append("telemetry_redaction_not_recorded_true")

    slos = observation.get("slos", [])
    if not slos:
        errors.append("at_least_one_slo_required")
    for slo in slos:
        for key in ("id", "metric", "unit"):
            if not slo.get(key):
                errors.append(f"missing:slo.{key}")
        operator = slo.get("operator")
        if operator not in {"<", "<=", ">", ">=", "=="}:
            errors.append(f"invalid_slo_operator:{slo.get('id', 'unknown')}")
            continue
        target = slo.get("target")
        observed = slo.get("observed")
        if not isinstance(target, (int, float)) or not isinstance(observed, (int, float)):
            errors.append(f"invalid_slo_values:{slo.get('id', 'unknown')}")
            continue
        computed = compare(operator, float(observed), float(target))
        if slo.get("passed") is not computed:
            errors.append(f"slo_pass_flag_inconsistent:{slo.get('id', 'unknown')}")
        if not computed:
            errors.append(f"slo_failed:{slo.get('id', 'unknown')}")
        require_hex(
            slo.get("evidenceSha256"),
            HEX64,
            f"slo.{slo.get('id', 'unknown')}.evidenceSha256",
            errors,
        )

    rollback = payload.get("rollback", {})
    if rollback.get("demonstrated") is not True:
        errors.append("rollback_or_recovery_drill_must_be_demonstrated")
    if rollback.get("outcome") != "PASS":
        errors.append("rollback_outcome_must_be_PASS")
    recovery = rollback.get("recoveryTimeSeconds")
    objective = rollback.get("objectiveSeconds")
    if not isinstance(recovery, (int, float)) or not isinstance(objective, (int, float)):
        errors.append("rollback_recovery_and_objective_must_be_numeric")
    elif objective <= 0 or recovery < 0 or recovery > objective:
        errors.append("rollback_recovery_objective_not_met")
    rollback_start = parse_time(rollback.get("startedAt"), "rollback.startedAt", errors)
    rollback_end = parse_time(rollback.get("completedAt"), "rollback.completedAt", errors)
    if rollback_start and rollback_end and rollback_end <= rollback_start:
        errors.append("rollback_completedAt_must_follow_startedAt")
    require_hex(
        rollback.get("evidenceSha256"),
        HEX64,
        "rollback.evidenceSha256",
        errors,
    )

    incidents = payload.get("incidents", {})
    records = incidents.get("records", [])
    none_observed = incidents.get("noneObserved")
    if none_observed is True and records:
        errors.append("incidents_noneObserved_conflicts_with_records")
    if none_observed is False and not records:
        errors.append("incident_records_required_when_noneObserved_false")
    for incident in records:
        if incident.get("status") not in {"resolved", "accepted"}:
            errors.append(f"incident_not_closed:{incident.get('incidentId', 'unknown')}")
        detected = parse_time(
            incident.get("detectedAt"),
            f"incident.{incident.get('incidentId', 'unknown')}.detectedAt",
            errors,
        )
        recovered = parse_time(
            incident.get("recoveredAt"),
            f"incident.{incident.get('incidentId', 'unknown')}.recoveredAt",
            errors,
        )
        if detected and recovered and recovered < detected:
            errors.append(
                f"incident_recovered_before_detected:{incident.get('incidentId', 'unknown')}"
            )
        require_hex(
            incident.get("evidenceSha256"),
            HEX64,
            f"incident.{incident.get('incidentId', 'unknown')}.evidenceSha256",
            errors,
        )

    linkage = payload.get("linkage", {})
    require_hex(
        linkage.get("l4ProofBundleSha256"),
        HEX64,
        "linkage.l4ProofBundleSha256",
        errors,
    )
    require_hex(
        linkage.get("releaseBindingSha256"),
        HEX64,
        "linkage.releaseBindingSha256",
        errors,
    )
    require_hex(linkage.get("sourceCommit"), HEX40, "linkage.sourceCommit", errors)
    if commit and linkage.get("sourceCommit") != commit:
        errors.append("linkage_sourceCommit_does_not_match_subject_commit")
    urls = linkage.get("attestationUrls", [])
    if not urls:
        errors.append("at_least_one_attestation_url_required")
    elif not all(isinstance(url, str) and url.startswith("https://") for url in urls):
        errors.append("attestation_urls_must_be_https")

    claim = payload.get("boundedClaim", {})
    if claim.get("status") != "PRODUCTION_VALIDATED":
        errors.append("boundedClaim.status_must_be_PRODUCTION_VALIDATED")
    if claim.get("environmentId") != environment_id:
        errors.append("boundedClaim_environment_mismatch")
    if claim.get("observationStart") != window.get("start"):
        errors.append("boundedClaim_observationStart_mismatch")
    if claim.get("observationEnd") != window.get("end"):
        errors.append("boundedClaim_observationEnd_mismatch")
    if not claim.get("scope"):
        errors.append("boundedClaim_scope_required")
    if not claim.get("exclusions"):
        errors.append("boundedClaim_exclusions_required")
    if not claim.get("statement"):
        errors.append("boundedClaim_statement_required")
    if not claim.get("approvals"):
        errors.append("boundedClaim_approval_required")

    return {
        "qualified": not errors,
        "schemaVersion": payload.get("schemaVersion"),
        "subjectCommit": commit,
        "deploymentId": deployment.get("deploymentId"),
        "environmentId": environment_id,
        "environmentClass": environment.get("class"),
        "observationSeconds": duration,
        "sampleCount": observation.get("sampleCount"),
        "sloCount": len(slos),
        "incidentCount": len(records),
        "rollbackDemonstrated": rollback.get("demonstrated") is True,
        "claimStatus": claim.get("status"),
        "errors": errors,
        "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "path",
        nargs="?",
        default="evidence/deployment-evidence.json",
    )
    parser.add_argument("--expected-commit")
    parser.add_argument("--minimum-observation-seconds", type=int, default=1)
    parser.add_argument("--expect-not-qualified", action="store_true")
    args = parser.parse_args()

    path = pathlib.Path(args.path)
    if not path.is_file():
        raise SystemExit(f"Deployment evidence not found: {path}")

    payload = json.loads(path.read_text(encoding="utf-8"))
    result = assess_deployment_evidence(
        payload,
        expected_commit=args.expected_commit,
        minimum_observation_seconds=args.minimum_observation_seconds,
    )
    result["sourcePath"] = str(path)
    result["sourceSha256"] = sha256(path)
    print(json.dumps(result, indent=2, sort_keys=True))

    if args.expect_not_qualified:
        return 0 if not result["qualified"] else 3
    return 0 if result["qualified"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
