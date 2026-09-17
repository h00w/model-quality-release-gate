#!/usr/bin/env python3
"""Generate a Production AI Evidence Contract v1 reproduction bundle."""
from __future__ import annotations
import datetime as dt, glob, hashlib, json, os, pathlib, platform, shutil, subprocess, sys, time, uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
CFG_PATH = ROOT / "evidence" / "reproduce-config.json"
SCHEMA_PATH = ROOT / "evidence" / "production-ai-evidence-contract-v1.schema.json"
OUT = ROOT / "evidence" / "out" / "current"


def run_text(cmd):
    try: return subprocess.check_output(cmd, cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception: return None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""): h.update(chunk)
    return h.hexdigest()


def digest(path):
    p = pathlib.Path(path)
    return {"path": p.relative_to(ROOT).as_posix(), "sha256": sha256(p), "sizeBytes": p.stat().st_size}


def expand(patterns):
    seen, files = set(), []
    for pattern in patterns:
        for name in sorted(glob.glob(str(ROOT / pattern), recursive=True)):
            p = pathlib.Path(name)
            if p.is_file() and p not in seen and "evidence/out/" not in p.as_posix():
                seen.add(p); files.append(digest(p))
    return files


def command_version(cmd):
    try: return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception: return None


def main():
    cfg = json.loads(CFG_PATH.read_text(encoding="utf-8"))
    shutil.rmtree(OUT, ignore_errors=True); OUT.mkdir(parents=True, exist_ok=True)
    git_commit = run_text(["git", "rev-parse", "HEAD"]) or ("0" * 40)
    git_branch = run_text(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    dirty = bool(run_text(["git", "status", "--porcelain"]))
    remote = (run_text(["git", "config", "--get", "remote.origin.url"]) or cfg["repository"]).removesuffix(".git")
    if remote.startswith("git@github.com:"): remote = "https://github.com/" + remote.split(":", 1)[1]

    command = cfg["verification_command"]
    started = time.monotonic(); proc = subprocess.run(command, cwd=ROOT, shell=True, text=True, capture_output=True)
    duration = round(time.monotonic() - started, 3)
    stdout = OUT / "verification.stdout.log"; stderr = OUT / "verification.stderr.log"
    stdout.write_text(proc.stdout or "", encoding="utf-8"); stderr.write_text(proc.stderr or "", encoding="utf-8")
    status = "PASS" if proc.returncode == 0 else "FAIL"
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    evidence = {
        "contractVersion": "1.0.0", "evidenceId": str(uuid.uuid4()), "createdAt": now,
        "subject": {"name": cfg["name"], "type": cfg["subject_type"], "repository": remote, "gitCommit": git_commit, "gitBranch": git_branch, "version": cfg.get("version"), "dirty": dirty},
        "environment": {"os": platform.platform(), "architecture": platform.machine(), "python": sys.version.split()[0], "node": command_version(["node", "--version"]), "containerDigest": os.getenv("CONTAINER_DIGEST"), "dependencyFiles": expand(cfg.get("dependency_patterns", []))},
        "inputs": expand(cfg.get("input_patterns", [])),
        "benchmark": {"name": cfg.get("benchmark_name"), "version": cfg.get("benchmark_version"), "files": expand(cfg.get("benchmark_patterns", []))},
        "policy": {"name": cfg.get("policy_name"), "version": cfg.get("policy_version"), "files": expand(cfg.get("policy_patterns", []))},
        "evaluation": {"verificationCommand": command, "exitCode": proc.returncode, "status": status, "durationSeconds": duration, "stdoutArtifact": stdout.name, "stderrArtifact": stderr.name, "metrics": {}},
        "approvals": {"required": bool(cfg.get("approvals_required", False)), "records": []},
        "decision": {"reproductionStatus": status, "releaseState": None, "reason": "Repository verification chain passed." if status == "PASS" else "Repository verification chain failed; inspect retained logs."},
        "provenance": {"builder": "scripts/reproduce.py@production-ai-evidence-contract-v1", "invocation": "make reproduce", "source": {"repository": remote, "gitCommit": git_commit}},
        "artifacts": [digest(stdout), digest(stderr)],
        "extensions": {"schemaSha256": sha256(SCHEMA_PATH), "note": "Reproduction PASS is not a production SHIP/approval decision."}
    }
    bundle = OUT / "evidence.json"; bundle.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    (OUT / "checksums.sha256").write_text("\n".join(f"{sha256(p)}  {p.name}" for p in [bundle, stdout, stderr]) + "\n", encoding="utf-8")
    (OUT / "summary.md").write_text(f"# Reproduction Summary\n\n- Contract: Production AI Evidence Contract v1.0.0\n- Subject: {cfg['name']}\n- Git commit: `{git_commit}`\n- Dirty working tree: `{dirty}`\n- Verification: **{status}**\n- Exit code: `{proc.returncode}`\n- Duration: `{duration}s`\n\n> A reproduction PASS confirms the configured verification chain completed successfully for this source/environment. It is not a production release authorization.\n", encoding="utf-8")
    print(f"Production AI Evidence Contract v1: {status}\nEvidence: {bundle.relative_to(ROOT)}")
    return proc.returncode


if __name__ == "__main__": raise SystemExit(main())
