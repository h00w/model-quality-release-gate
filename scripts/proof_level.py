"""Assess a repository against Production AI Five-Level Proof Model v1."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "evidence" / "out" / "current"
EVIDENCE_PATH = OUT / "evidence.json"
CONFIG_PATH = ROOT / "evidence" / "proof-config.json"
MODEL_PATH = ROOT / "evidence" / "production-ai-proof-model-v1.json"


def sha256(path: pathlib.Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def verify_checksums() -> tuple[bool, list[str]]:
    manifest = OUT / "checksums.sha256"
    if not manifest.is_file():
        return False, ["missing checksums.sha256"]
    errors: list[str] = []
    for raw in manifest.read_text(encoding="utf-8").splitlines():
        if not raw.strip():
            continue
        expected, name = raw.split(None, 1)
        path = OUT / name.strip()
        if not path.is_file():
            errors.append(f"missing:{name.strip()}")
        elif sha256(path) != expected:
            errors.append(f"sha256_mismatch:{name.strip()}")
    return not errors, errors


def field_value(payload: dict, dotted: str):
    value = payload
    for part in dotted.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def paths_exist(patterns: list[str]) -> tuple[bool, list[str]]:
    missing = []
    for pattern in patterns:
        if not list(ROOT.glob(pattern)):
            missing.append(pattern)
    return not missing, missing


def external_evidence(items: list[dict], offline: bool) -> tuple[bool, list[dict]]:
    results = []
    for item in items:
        result = {
            "kind": item["kind"],
            "displayUrl": item.get("displayUrl", item["url"]),
            "required": bool(item.get("required", True)),
        }
        if offline:
            result["status"] = "SKIPPED_OFFLINE"
            result["httpStatus"] = None
        else:
            request = urllib.request.Request(
                item["url"],
                headers={"User-Agent": "production-ai-proof-model/1.0"},
            )
            try:
                with urllib.request.urlopen(request, timeout=15) as response:
                    result["httpStatus"] = response.status
                    result["status"] = "VERIFIED" if response.status < 400 else "FAILED"
            except (OSError, urllib.error.URLError, TimeoutError) as exc:
                result["httpStatus"] = None
                result["status"] = "FAILED"
                result["error"] = type(exc).__name__
        results.append(result)
    if offline:
        return False, results
    required = [item for item in results if item["required"]]
    return bool(required) and all(item["status"] == "VERIFIED" for item in required), results


def level_record(level: int, name: str, passed: bool, reason: str) -> dict:
    return {"level": level, "name": name, "status": "PASS" if passed else "NOT_PROVEN", "reason": reason}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()

    evidence = json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    model = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
    names = {item["level"]: item["name"] for item in model["levels"]}

    levels = []

    level1 = (
        evidence.get("evaluation", {}).get("status") == "PASS"
        and bool(evidence.get("subject", {}).get("gitCommit"))
    )
    levels.append(level_record(1, names[1], level1, "Configured verification chain passed and source commit is recorded."))

    checksum_ok, checksum_errors = verify_checksums()
    level2 = (
        level1
        and evidence.get("subject", {}).get("dirty") is False
        and checksum_ok
        and bool(evidence.get("environment", {}).get("dependencyFiles"))
        and bool(evidence.get("benchmark", {}).get("files"))
        and bool(evidence.get("policy", {}).get("files"))
    )
    level2_reason = "Clean source, verified checksums, and dependency/benchmark/policy digests are present."
    if checksum_errors:
        level2_reason += " Checksum errors: " + ", ".join(checksum_errors)
    levels.append(level_record(2, names[2], level2, level2_reason))

    external_ok, external_results = external_evidence(config.get("externalEvidence", []), args.offline)
    level3 = level2 and external_ok and config.get("maxLevel", 2) >= 3
    level3_reason = (
        "Versioned benchmark evidence is bound to independently inspectable public capability evidence."
        if level3
        else "Public capability evidence was not fully verified in this run."
    )
    levels.append(level_record(3, names[3], level3, level3_reason))

    level4_cfg = config.get("level4", {})
    required_ok, missing_paths = paths_exist(level4_cfg.get("requiredPaths", []))
    decision_cfg = level4_cfg.get("decision")
    decision_ok = bool(level4_cfg) and required_ok
    if decision_cfg and decision_ok:
        decision_path = ROOT / decision_cfg["path"]
        decision_payload = json.loads(decision_path.read_text(encoding="utf-8"))
        decision_ok = field_value(decision_payload, decision_cfg["field"]) in decision_cfg["allowedValues"]
    level4 = level3 and config.get("maxLevel", 3) >= 4 and decision_ok
    level4_reason = (
        "Release-candidate package exists and its machine-readable decision satisfies the configured gate."
        if level4
        else "Release-candidate proof is incomplete or intentionally outside this repository's current ceiling."
    )
    if missing_paths:
        level4_reason += " Missing: " + ", ".join(missing_paths)
    levels.append(level_record(4, names[4], level4, level4_reason))

    level5_cfg = config.get("level5", {})
    level5_paths_ok, missing_level5 = paths_exist(level5_cfg.get("requiredPaths", []))
    level5 = (
        level4
        and config.get("maxLevel", 4) >= 5
        and bool(level5_cfg.get("enabled"))
        and level5_paths_ok
    )
    level5_reason = (
        "Target-environment production evidence satisfies the configured production-validation policy."
        if level5
        else level5_cfg.get(
            "reason",
            "Target-environment observation, SLO, and recovery evidence is not established.",
        )
    )
    if missing_level5:
        level5_reason += " Missing: " + ", ".join(missing_level5)
    levels.append(level_record(5, names[5], level5, level5_reason))

    achieved = 0
    for item in levels:
        if item["status"] != "PASS":
            break
        achieved = item["level"]

    executor = {
        "system": "github-actions" if os.getenv("GITHUB_ACTIONS") == "true" else "local",
        "repository": os.getenv("GITHUB_REPOSITORY"),
        "runId": os.getenv("GITHUB_RUN_ID"),
    }
    if os.getenv("GITHUB_SERVER_URL") and os.getenv("GITHUB_REPOSITORY") and os.getenv("GITHUB_RUN_ID"):
        executor["runUrl"] = (
            f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}"
            f"/actions/runs/{os.environ['GITHUB_RUN_ID']}"
        )

    proof = {
        "proofModelVersion": model["proofModelVersion"],
        "subject": evidence["subject"],
        "sourceEvidence": str(EVIDENCE_PATH.relative_to(ROOT)),
        "sourceEvidenceSha256": sha256(EVIDENCE_PATH),
        "proofModelSha256": sha256(MODEL_PATH),
        "achievedLevel": achieved,
        "achievedLabel": names.get(achieved, "Unproven"),
        "configuredCeiling": config.get("maxLevel"),
        "offline": args.offline,
        "executor": executor,
        "externalEvidence": external_results,
        "levels": levels,
    }

    proof_path = OUT / "proof.json"
    proof_path.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")

    rows = "\n".join(
        f"| {item['level']} | {item['name']} | {item['status']} | {item['reason']} |"
        for item in levels
    )
    summary = (
        "# Production AI Proof Summary\n\n"
        f"- Achieved level: **L{achieved} — {proof['achievedLabel']}**\n"
        f"- Configured ceiling: **L{config.get('maxLevel')}**\n"
        f"- Offline assessment: **{args.offline}**\n"
        f"- Evidence SHA-256: `{proof['sourceEvidenceSha256']}`\n"
        f"- Proof-model SHA-256: `{proof['proofModelSha256']}`\n\n"
        "| Level | Name | Status | Reason |\n"
        "|---:|---|---|---|\n"
        f"{rows}\n\n"
        "> Proof levels are cumulative. A higher level is never inferred from a lower-level PASS.\n"
    )
    (OUT / "proof-summary.md").write_text(summary, encoding="utf-8")

    print(f"Production AI proof: L{achieved} — {proof['achievedLabel']}")
    print(f"Proof: {proof_path.relative_to(ROOT)}")

    required_level = min(config.get("minimumLevel", 2), 2) if args.offline else config.get("minimumLevel", 2)
    return 0 if achieved >= required_level else 2


if __name__ == "__main__":
    raise SystemExit(main())
