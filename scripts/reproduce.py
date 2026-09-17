#!/usr/bin/env python3
"""Generate a Production AI Evidence Contract v1 reproduction bundle.

The script intentionally uses only the Python standard library. Project-specific
commands and input paths live in evidence/reproduction-plan.json so the same
contract can be reused across heterogeneous repositories.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PLAN_PATH = ROOT / "evidence" / "reproduction-plan.json"
SCHEMA_PATH = ROOT / "evidence" / "production-ai-evidence-contract-v1.schema.json"
CONTRACT_SOURCE = (
    "https://raw.githubusercontent.com/h00w/model-quality-release-gate/main/"
    "evidence/production-ai-evidence-contract-v1.schema.json"
)


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_path(path: Path) -> str:
    """Hash a file or a directory tree deterministically."""
    if path.is_file():
        return sha256_file(path)
    if not path.exists():
        raise FileNotFoundError(path)
    h = hashlib.sha256()
    ignored = {".git", ".venv", "node_modules", "__pycache__", ".pytest_cache", "artifacts"}
    for child in sorted(p for p in path.rglob("*") if p.is_file()):
        if any(part in ignored for part in child.relative_to(path).parts):
            continue
        rel = child.relative_to(ROOT).as_posix().encode("utf-8")
        h.update(rel)
        h.update(b"\0")
        h.update(sha256_file(child).encode("ascii"))
        h.update(b"\n")
    return h.hexdigest()


def run_capture(argv: list[str], cwd: Path | None = None) -> tuple[int, str]:
    try:
        proc = subprocess.run(
            argv,
            cwd=str(cwd or ROOT),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        return proc.returncode, proc.stdout
    except FileNotFoundError as exc:
        return 127, f"command not found: {exc}\n"


def git_value(*args: str) -> str | None:
    code, out = run_capture(["git", *args])
    return out.strip() if code == 0 else None


def tool_version(command: list[str]) -> str | None:
    code, out = run_capture(command)
    if code != 0:
        return None
    return out.strip().splitlines()[0] if out.strip() else None


def substitute(argv: list[str]) -> list[str]:
    mapping = {
        "{python}": sys.executable,
        "{repo}": str(ROOT),
    }
    return [mapping.get(token, token) for token in argv]


def media_type(path: Path) -> str:
    if path.suffix == ".json":
        return "application/json"
    if path.suffix in {".md", ".txt", ".log"}:
        return "text/plain"
    return "application/octet-stream"


def main() -> int:
    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    schema_hash = sha256_file(SCHEMA_PATH)
    commit = git_value("rev-parse", "HEAD")
    if not commit or len(commit) != 40:
        print("error: repository must be a Git checkout with a resolvable HEAD", file=sys.stderr)
        return 2

    branch = git_value("rev-parse", "--abbrev-ref", "HEAD")
    dirty = bool((git_value("status", "--porcelain", "--untracked-files=no") or "").strip())
    short = commit[:12]
    run_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + short
    output_base = Path(os.environ.get("REPRO_OUT", ROOT / "artifacts" / "reproduction"))
    if not output_base.is_absolute():
        output_base = ROOT / output_base
    out_dir = output_base / run_id
    logs_dir = out_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=False)

    started_at = utc_now()
    steps: list[dict[str, Any]] = []
    all_passed = True

    for index, step in enumerate(plan["steps"], start=1):
        argv = substitute(step["command"])
        cwd = ROOT / step.get("cwd", ".")
        step_started = time.monotonic()
        code, output = run_capture(argv, cwd=cwd)
        duration = round(time.monotonic() - step_started, 6)
        safe_name = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in step["name"])
        log_rel = Path("logs") / f"{index:02d}-{safe_name}.log"
        (out_dir / log_rel).write_text(output, encoding="utf-8")
        passed = code == 0
        all_passed = all_passed and passed
        steps.append(
            {
                "name": step["name"],
                "command": argv,
                "cwd": step.get("cwd", "."),
                "exit_code": code,
                "duration_seconds": duration,
                "passed": passed,
                "log": log_rel.as_posix(),
            }
        )
        if not passed and not step.get("continue_on_failure", False):
            break

    inputs: list[dict[str, str]] = []
    missing_inputs: list[str] = []
    for item in plan.get("inputs", []):
        path = ROOT / item["path"]
        if not path.exists():
            missing_inputs.append(item["path"])
            continue
        inputs.append(
            {
                "path": item["path"],
                "kind": item.get("kind", "input"),
                "sha256": sha256_path(path),
            }
        )

    if missing_inputs:
        all_passed = False

    if not all_passed:
        status = "FAILED"
        rationale = "One or more reproduction steps or declared inputs failed verification."
    elif dirty:
        status = "PARTIAL"
        rationale = "All declared steps passed, but tracked working-tree changes were present; the run is not a clean-commit reproduction."
    else:
        status = "REPRODUCED"
        rationale = "All declared deterministic reproduction steps passed from a clean tracked working tree."

    environment = {
        "os": platform.platform(),
        "architecture": platform.machine(),
        "python": sys.version.split()[0],
        "tools": {
            "git": tool_version(["git", "--version"]),
            "node": tool_version(["node", "--version"]),
            "npm": tool_version(["npm", "--version"]),
            "make": tool_version(["make", "--version"]),
        },
    }

    finished_at = utc_now()
    notes = list(plan.get("notes", []))
    if missing_inputs:
        notes.append("Missing declared inputs: " + ", ".join(missing_inputs))
    notes.append("REPRODUCED is a reproduction status, not a production deployment authorization.")

    summary_lines = [
        f"# Reproduction Summary — {plan['project']['name']}",
        "",
        f"- Contract: Production AI Evidence Contract v1.0.0",
        f"- Repository commit: `{commit}`",
        f"- Branch: `{branch}`",
        f"- Working tree dirty: `{str(dirty).lower()}`",
        f"- Reproduction status: **{status}**",
        f"- Started: {started_at}",
        f"- Finished: {finished_at}",
        "",
        "## Verification steps",
        "",
    ]
    for step in steps:
        marker = "PASS" if step["passed"] else "FAIL"
        summary_lines.append(
            f"- **{marker}** — `{step['name']}` — exit `{step['exit_code']}` — {step['duration_seconds']:.3f}s"
        )
    if missing_inputs:
        summary_lines += ["", "## Missing inputs", ""] + [f"- `{x}`" for x in missing_inputs]
    summary_lines += [
        "",
        "## Interpretation",
        "",
        rationale,
        "",
        "This bundle records deterministic reproduction evidence. Domain-specific SHIP / INVESTIGATE / HOLD decisions remain governed by the project's release policy and are not inferred from this reproduction status.",
        "",
    ]
    summary_path = out_dir / "summary.md"
    summary_path.write_text("\n".join(summary_lines), encoding="utf-8")

    artifacts: list[dict[str, str]] = []
    for artifact in sorted([summary_path, *logs_dir.glob("*.log")]):
        artifacts.append(
            {
                "path": artifact.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(artifact),
                "media_type": media_type(artifact),
            }
        )

    evidence = {
        "contract_version": "1.0.0",
        "generated_at": finished_at,
        "contract_source": CONTRACT_SOURCE,
        "schema_sha256": schema_hash,
        "repository": {
            "name": plan["project"]["repository_name"],
            "url": plan["project"]["repository_url"],
            "git_commit": commit,
            "branch": branch,
            "dirty": dirty,
        },
        "subject": {
            "name": plan["project"]["name"],
            "type": plan["project"]["subject_type"],
            "version": plan["project"].get("version", "git:" + short),
            "candidate_id": plan["project"].get("candidate_id"),
        },
        "environment": environment,
        "inputs": inputs,
        "execution": {
            "started_at": started_at,
            "finished_at": finished_at,
            "steps": steps,
        },
        "decision": {
            "status": status,
            "rationale": rationale,
            "domain_decision": plan.get("domain_decision"),
            "domain_decision_source": plan.get("domain_decision_source"),
        },
        "artifacts": artifacts,
        "notes": notes,
    }

    evidence_path = out_dir / "evidence.json"
    evidence_path.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    checksum_targets = sorted([evidence_path, summary_path, *logs_dir.glob("*.log")])
    checksum_text = "".join(
        f"{sha256_file(path)}  {path.relative_to(out_dir).as_posix()}\n" for path in checksum_targets
    )
    (out_dir / "checksums.sha256").write_text(checksum_text, encoding="utf-8")

    latest = output_base / "LATEST"
    latest.parent.mkdir(parents=True, exist_ok=True)
    latest.write_text(run_id + "\n", encoding="utf-8")

    print(f"Production AI Evidence Contract v1 bundle: {out_dir}")
    print(f"status: {status}")
    return 0 if status in {"REPRODUCED", "PARTIAL"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
