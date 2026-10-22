#!/usr/bin/env python3
"""Check declared governance package structure, never semantic adoption.

Standard-library reference implementation; a project may port this contract into
its existing gate. Paths are relative to the explicitly supplied governed root.
External-root and independent-repository inheritance need a project-specific
checker with an explicit boundary; this generic implementation rejects them.
"""

from __future__ import annotations

import argparse
import json
import posixpath
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

SCHEMA_VERSION = 1
DEFAULT_CONTRACT = "governance/contract.json"
CORE_ROLES = {
    "entrypoint", "maintenance", "decisions", "agent_log", "architecture",
    "changelog", "current_state",
}
PACKAGE_ROLES = {"maintenance", "decisions", "agent_log"}
VERSION_RE = re.compile(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?")


class StructureError(ValueError):
    pass


def relative_path(value: object, label: str, *, allow_root: bool = False) -> str:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        raise StructureError(f"{label} must be a normalized project-root-relative path")
    path = PurePosixPath(value)
    if (path.is_absolute() or ":" in value or value != path.as_posix()
            or ".." in path.parts or (value == "." and not allow_root)):
        raise StructureError(f"{label} must be a normalized project-root-relative path")
    return value


def under(path: str, directory: str) -> bool:
    return directory == "." or path == directory or path.startswith(directory + "/")


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise StructureError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def has_owner_content(text: str) -> bool:
    """Reject empty skeletons, not judge correctness or completeness of prose."""
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line in {"---", "```", "~~~"}:
            continue
        line = re.sub(r"^(?:[-*+] |\d+\. )", "", line).strip(" `")
        if re.fullmatch(r"(?:TODO|TBD|PLACEHOLDER|\.\.\.|<[^>]*>|\{\{.*\}\})", line, re.IGNORECASE):
            continue
        return True
    return False


class Snapshot:
    """One root-contained filesystem or Git index; no ancestor discovery."""

    def __init__(self, root: Path, kind: str = "working tree") -> None:
        if kind not in {"working tree", "staged index"}:
            raise StructureError("snapshot must be working tree or staged index")
        self.root = root.resolve()
        self.kind = kind
        self.index: dict[str, tuple[str, str]] | None = None
        if not self.root.is_dir():
            raise StructureError("governed project root is not a directory")
        if kind == "staged index":
            top = self.git("rev-parse", "--show-toplevel").decode().rstrip("\n")
            if Path(top).resolve() != self.root:
                raise StructureError("staged inspection requires the governed root to be the Git root")
            self.index = {}
            for record in self.git("ls-files", "--stage", "-z").split(b"\0"):
                if not record:
                    continue
                metadata, raw_path = record.split(b"\t", 1)
                mode, identity, stage = metadata.decode("ascii").split()
                if stage != "0":
                    raise StructureError("unmerged index cannot establish package structure")
                self.index[raw_path.decode("utf-8", "surrogateescape")] = (mode, identity)

    def git(self, *args: str) -> bytes:
        result = subprocess.run(
            ["git", "-C", str(self.root), *args], capture_output=True, check=False,
        )
        if result.returncode:
            raise StructureError("could not inspect Git index for package structure")
        return result.stdout

    def resolved(self, path: str) -> str:
        if self.index is None:
            try:
                physical = (self.root / path).resolve()
                relative = physical.relative_to(self.root)
            except (OSError, RuntimeError, ValueError) as exc:
                raise StructureError(f"path escapes governed root or has a symlink loop: {path}") from exc
            for parent in (physical, *physical.parents):
                if parent == self.root:
                    break
                if (parent / ".git").exists():
                    raise StructureError(f"independent repository boundary: {path}")
            return relative.as_posix()
        current = path
        for _ in range(40):
            parts = PurePosixPath(current).parts
            for offset in range(1, len(parts) + 1):
                prefix = "/".join(parts[:offset])
                item = self.index.get(prefix)
                if item is None:
                    continue
                mode, identity = item
                if mode == "160000":
                    raise StructureError(f"independent repository boundary: {path}")
                if mode == "120000":
                    link = self.git("cat-file", "blob", identity).decode("utf-8")
                    if PurePosixPath(link).is_absolute() or "\\" in link or "\x00" in link:
                        raise StructureError(f"symlink escapes governed root: {path}")
                    current = posixpath.normpath(posixpath.join(
                        posixpath.dirname(prefix), link, *parts[offset:],
                    ))
                    if current == ".." or current.startswith("../"):
                        raise StructureError(f"symlink escapes governed root: {path}")
                    break
            else:
                return current
        raise StructureError(f"symlink loop: {path}")

    def exists(self, path: str) -> bool:
        resolved = self.resolved(path)
        if self.index is not None:
            return resolved in self.index or any(under(key, resolved) for key in self.index)
        # A dangling symlink is present but invalid, not an absent disposable package.
        return (self.root / path).exists() or (self.root / path).is_symlink()

    def directory(self, path: str) -> bool:
        resolved = self.resolved(path)
        if self.index is not None:
            return any(key != resolved and under(key, resolved) for key in self.index)
        return (self.root / resolved).is_dir()

    def read(self, path: str) -> str:
        resolved = self.resolved(path)
        try:
            if self.index is not None:
                mode, identity = self.index[resolved]
                if mode not in {"100644", "100755"}:
                    raise StructureError(f"owner is not a regular readable file: {path}")
                return self.git("cat-file", "blob", identity).decode("utf-8")
            return (self.root / resolved).read_text(encoding="utf-8")
        except (KeyError, OSError, UnicodeError) as exc:
            raise StructureError(f"missing or unreadable owner: {path}") from exc


@dataclass
class StructureResult:
    snapshot: str
    issues: list[str] = field(default_factory=list)
    skipped: bool = False
    roles: dict[str, str] = field(default_factory=dict)


def check_package(
    project_root: Path, *, target: Path | None = None, lifecycle: str = "durable",
    contract_path: str = DEFAULT_CONTRACT, snapshot: str = "working tree",
) -> StructureResult:
    result = StructureResult(snapshot)
    try:
        if lifecycle not in {"durable", "disposable"}:
            raise StructureError("project lifecycle must be explicitly durable or disposable")
        root = project_root.resolve()
        target = (target or Path.cwd()).resolve()
        try:
            target_path = target.relative_to(root).as_posix()
        except ValueError as exc:
            raise StructureError("target is outside the explicitly governed project root") from exc
        if not target.is_dir():
            raise StructureError("target must be an existing project directory")
        source = Snapshot(root, snapshot)
        # Check real target boundaries even when inspecting the staged index.
        Snapshot(root).resolved(target_path)
        contract_path = relative_path(contract_path, "contract path")
        if not source.exists(contract_path):
            if lifecycle == "disposable":
                result.skipped = True
                return result
            raise StructureError(f"durable project is missing governance contract: {contract_path}")
        data = json.loads(source.read(contract_path), object_pairs_hook=unique_object)
        expected = {"schema_version", "source_skill_version", "package_root", "coverage", "design", "roles"}
        if not isinstance(data, dict) or set(data) != expected:
            raise StructureError("contract fields must be exactly " + ", ".join(sorted(expected)))
        if type(data["schema_version"]) is not int or data["schema_version"] != SCHEMA_VERSION:
            raise StructureError("unsupported governance contract schema_version")
        version = data["source_skill_version"]
        if not isinstance(version, str) or not VERSION_RE.fullmatch(version):
            raise StructureError("source_skill_version must identify a source version; it is not adoption evidence")
        package = relative_path(data["package_root"], "package_root")
        if not source.directory(package) or not under(contract_path, package):
            raise StructureError("contract must be inside its dedicated package_root directory")
        if not under(source.resolved(contract_path), source.resolved(package)):
            raise StructureError("contract resolves outside its dedicated package_root")
        coverage = data["coverage"]
        if not isinstance(coverage, list) or not coverage:
            raise StructureError("coverage must declare at least one governed directory")
        covered = [relative_path(value, "coverage", allow_root=True) for value in coverage]
        if len(set(covered)) != len(covered):
            raise StructureError("coverage directories must be unique")
        for directory in covered:
            if not source.directory(directory):
                raise StructureError(f"coverage directory does not exist: {directory}")
        if not any(under(target_path, directory) for directory in covered):
            raise StructureError("target is not covered by this governance contract")
        design = data["design"]
        if (not isinstance(design, dict) or set(design) != {"applicable", "reason"}
                or type(design["applicable"]) is not bool
                or not isinstance(design["reason"], str) or not design["reason"].strip()):
            raise StructureError("design needs boolean applicable and a nonempty project-specific reason")
        roles = data["roles"]
        required = CORE_ROLES | ({"design"} if design["applicable"] else set())
        if not isinstance(roles, dict) or set(roles) != required:
            raise StructureError("role coverage must be exactly " + ", ".join(sorted(required)))
        roles = {key: relative_path(value, f"role {key}") for key, value in roles.items()}
        resolved_contract = source.resolved(contract_path)
        if any(path == contract_path or source.resolved(path) == resolved_contract
               for path in roles.values()):
            raise StructureError("contract must remain separate from every mapped prose owner")
        if roles["entrypoint"] not in {"AGENTS.md", "AGENTS.override.md"}:
            raise StructureError("entrypoint must be root AGENTS.md or AGENTS.override.md")
        for role in PACKAGE_ROLES:
            if not under(roles[role], package) or not under(source.resolved(roles[role]), source.resolved(package)):
                raise StructureError(f"central {role} owner must remain inside package_root")
        if len({source.resolved(roles[key]) for key in PACKAGE_ROLES}) != len(PACKAGE_ROLES):
            raise StructureError("maintenance, decisions and agent_log need distinct central owners")
        central_paths = {source.resolved(roles[key]) for key in PACKAGE_ROLES}
        if any(source.resolved(path) in central_paths
               for key, path in roles.items() if key not in PACKAGE_ROLES):
            raise StructureError("central owners must not also own mapped project responsibilities")
        texts = {}
        for role, path in roles.items():
            texts[role] = source.read(path)
            if not texts[role].strip():
                raise StructureError(f"empty owner for {role}: {path}")
            if not has_owner_content(texts[role]):
                raise StructureError(f"owner contains only headings or template placeholders: {path}")
        # A literal root-relative pointer in AGENTS and a relative contract pointer
        # in maintenance are stable structure. Whether agents consume them is semantic.
        if roles["maintenance"] not in texts["entrypoint"]:
            raise StructureError("root entrypoint must name the root-relative maintenance owner")
        local_contract = posixpath.relpath(contract_path, posixpath.dirname(roles["maintenance"]))
        if local_contract not in texts["maintenance"] and contract_path not in texts["maintenance"]:
            raise StructureError("maintenance owner must name its contract path")
        result.roles = roles
    except (StructureError, json.JSONDecodeError, OSError, RuntimeError, UnicodeError) as exc:
        result.issues.append(str(exc))
    return result


def report(result: StructureResult) -> None:
    if result.skipped:
        print(f"SKIP: GOVERNANCE STRUCTURE ONLY ({result.snapshot}): explicitly disposable; no contract.")
    elif result.issues:
        print(f"FAIL: GOVERNANCE STRUCTURE ONLY ({result.snapshot}):")
        for issue in result.issues:
            print(f"- {issue}")
    else:
        print(f"PASS: GOVERNANCE STRUCTURE ONLY ({result.snapshot}).")
    print("Semantic adoption, authority, design acceptance and actual instruction loading are not established.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    parser.add_argument("--target", type=Path, default=Path.cwd())
    parser.add_argument("--project-lifecycle", choices=("durable", "disposable"), required=True)
    parser.add_argument("--contract", default=DEFAULT_CONTRACT)
    parser.add_argument("--snapshot", choices=("working tree", "staged index"), default="working tree")
    args = parser.parse_args(argv)
    result = check_package(args.project_root, target=args.target, lifecycle=args.project_lifecycle,
                           contract_path=args.contract, snapshot=args.snapshot)
    report(result)
    return int(bool(result.issues))


if __name__ == "__main__":
    raise SystemExit(main())
