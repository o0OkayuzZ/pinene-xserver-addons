#!/usr/bin/env python3
"""One-way export of committed Git objects. Python standard library only.

No source worktree bytes, timestamps or checkout line-ending conversions enter
the export. Writes happen in a disposable checkout; only a verified Git commit
is pushed, so readers never observe a partial export.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess

CONFIG = "tools/infinite_castle_mirror/config.json"
METADATA = "SOURCE_COMMIT.json"
ARCHIVE = "archive/initial-snapshot"


def git(repo, *args, data=None):
    return subprocess.check_output(["git", "-C", str(repo), *args], input=data)


def safe_name(name):
    p = PurePosixPath(name)
    if (not name or p.is_absolute() or "\\" in name or ":" in name
            or any(x in ("", ".", "..", ".git") for x in name.split("/"))):
        raise ValueError(f"Unsafe relative path: {name}")
    return name


class Revision:
    def __init__(self, repo, ref):
        self.repo = repo
        self.sha = git(repo, "rev-parse", "--verify", f"{ref}^{{commit}}").decode().strip()
        self.tree = {}
        for entry in git(repo, "ls-tree", "-rz", self.sha).split(b"\0"):
            if not entry:
                continue
            info, name = entry.split(b"\t", 1)
            mode, kind, oid = info.decode().split()
            self.tree[name.decode()] = (mode, kind, oid)

    def read(self, names):
        names = list(names)
        if not names:
            return {}
        for name in names:
            safe_name(name)
            mode, kind, _ = self.tree[name]
            if kind != "blob" or mode not in ("100644", "100755"):
                raise ValueError(f"Not a regular tracked file: {name}")
        data = git(self.repo, "cat-file", "--batch", data="".join(
            self.tree[n][2] + "\n" for n in names).encode())
        result, offset = {}, 0
        for name in names:
            end = data.index(b"\n", offset)
            size = int(data[offset:end].split()[2])
            result[name] = data[end + 1:end + 1 + size]
            offset = end + size + 2
        return result


def export(revision):
    config = json.loads(revision.read([CONFIG])[CONFIG])
    if config["schema"] != 1:
        raise ValueError("Unsupported config schema")
    manifests = revision.read(n for n in revision.tree if n.endswith("/manifest.json"))
    identities = {}
    for name, data in manifests.items():
        try:
            uuid = json.loads(data.decode("utf-8-sig")).get("header", {}).get("uuid")
        except (ValueError, UnicodeError):
            continue
        identities.setdefault(uuid, []).append(name.rsplit("/", 1)[0])
    mapping, resolved, roots = {}, {}, [".mirror"]
    for pack in config["packs"]:
        matches = identities.get(pack["uuid"], [])
        if len(matches) != 1:
            raise ValueError(f"Pack UUID {pack['uuid']} must resolve once; found {matches}")
        src, dst = matches[0], safe_name(pack["target"])
        roots.append(dst)
        resolved[dst] = src
        for name in revision.tree:
            if name.startswith(src + "/"):
                mapping[name] = dst + name[len(src):]
    mapping.update(config["files"])
    targets = [safe_name(n) for n in mapping.values()]
    if len(targets) != len(set(targets)) or METADATA in targets:
        raise ValueError("Colliding generated paths")
    for root in roots:
        safe_name(root)
        if any(root != other and root.startswith(other + "/") for other in roots):
            raise ValueError("Overlapping managed roots")
    raw = revision.read(mapping)
    files = {mapping[n]: (revision.tree[n][0], raw[n]) for n in mapping}
    owned_files = set(config["files"].values()) | {METADATA}
    return config, files, resolved, roots, owned_files


def contained(target, name):
    path = target / safe_name(name)
    for part in [path, *path.parents]:
        if part == target:
            break
        if part.is_symlink():
            raise ValueError(f"Symlink in destination: {part}")
    if not path.resolve().is_relative_to(target.resolve()):
        raise ValueError(f"Destination escapes checkout: {name}")
    return path


def inventory(target, roots, owned_files):
    names = set()
    for root in roots:
        path = contained(target, root)
        if path.is_file():
            raise ValueError(f"Managed directory replaced by file: {root}")
        if path.exists():
            for base, dirs, files in os.walk(path, followlinks=False):
                for name in dirs + files:
                    p = Path(base) / name
                    contained(target, p.relative_to(target).as_posix())
                names.update((Path(base) / n).relative_to(target).as_posix() for n in files)
    for name in owned_files:
        path = contained(target, name)
        if path.exists():
            if not path.is_file():
                raise ValueError(f"Managed file replaced by directory: {name}")
            names.add(name)
    return names


def hashes(files):
    return {n: {"mode": mode, "sha256": hashlib.sha256(data).hexdigest()}
            for n, (mode, data) in sorted(files.items())}


def differences(target, files, roots, owned_files):
    actual = inventory(target, roots, owned_files) - {METADATA}
    diffs = sorted(actual ^ files.keys())
    for name in actual & files.keys():
        path = contained(target, name)
        mode, data = files[name]
        if path.read_bytes() != data:
            diffs.append(name)
        elif os.name != "nt" and bool(path.stat().st_mode & 0o111) != (mode == "100755"):
            diffs.append(name + " (mode)")
    return sorted(diffs)


def validate_metadata(meta, config, files, resolved):
    if (meta.get("schema") != 1
            or meta.get("source_repository") != config["source_repository"]
            or meta.get("source_branch") != config["source_branch"]
            or meta.get("notice") != "AUTO-SYNCED MIRROR / DIRECT EDIT PROHIBITED"
            or meta.get("files") != hashes(files)
            or meta.get("resolved_packs") != resolved
            or not re.fullmatch(r"[0-9a-f]{40}", meta.get("source_commit", ""))):
        raise ValueError("Invalid or mismatched SOURCE_COMMIT.json")
    timestamp = datetime.fromisoformat(meta["synced_at"].replace("Z", "+00:00"))
    if timestamp.utcoffset() is None:
        raise ValueError("Sync timestamp must include timezone")


def sync(source, target, ref):
    revision = Revision(source, ref)
    config, files, resolved, roots, owned = export(revision)
    target = target.resolve()
    if source.resolve() == target:
        raise ValueError("Source and mirror must be separate directories")
    old = None
    meta_path = contained(target, METADATA)
    if meta_path.exists():
        try:
            old = json.loads(meta_path.read_bytes())
            validate_metadata(old, config, files, resolved)
        except (ValueError, KeyError, TypeError):
            old = None
    if old and not differences(target, files, roots, owned):
        # Verify that the retained provenance really produced these bytes.
        git(source, "merge-base", "--is-ancestor", old["source_commit"], revision.sha)
        verify(source, target)
        print(f"No changes; retaining source {old['source_commit']} and sync time")
        return False
    # Preflight the complete destination before any write/deletion.
    previous = inventory(target, roots, owned)
    if previous and not meta_path.exists():
        # First migration must preserve the entire previous committed snapshot.
        original = Revision(target, "HEAD")
        for name, data in original.read(original.tree).items():
            saved = contained(target, ARCHIVE + "/" + name)
            if not saved.is_file() or saved.read_bytes() != data:
                raise ValueError("Run archive command before first export into an existing mirror")
    for name in files:
        contained(target, name)
    meta = {
        "schema": 1,
        "source_repository": config["source_repository"],
        "source_branch": config["source_branch"],
        "source_commit": revision.sha,
        "synced_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "notice": "AUTO-SYNCED MIRROR / DIRECT EDIT PROHIBITED",
        "resolved_packs": resolved,
        "files": hashes(files),
    }
    output = dict(files)
    output[METADATA] = ("100644", (json.dumps(meta, indent=2, ensure_ascii=False) + "\n").encode())
    for name in previous - output.keys():
        contained(target, name).unlink()
    for name, (mode, data) in output.items():
        path = contained(target, name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        path.chmod(0o755 if mode == "100755" else 0o644)
    verify(source, target)
    print(f"Exported {len(files)} files from {revision.sha}")
    return True


def verify(source, target):
    target = target.resolve()
    meta = json.loads(contained(target, METADATA).read_bytes())
    sha = meta.get("source_commit", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected full source commit SHA")
    revision = Revision(source, sha)
    config, files, resolved, roots, owned = export(revision)
    validate_metadata(meta, config, files, resolved)
    diffs = differences(target, files, roots, owned)
    if diffs:
        raise ValueError("Mirror differs from recorded source: " + ", ".join(diffs))
    print(f"Verified {len(files)} files against {sha}")


def archive(target, ref):
    """One-time migration only: preserve all bytes at a reviewed mirror commit."""
    target = target.resolve()
    if (target / METADATA).exists():
        raise ValueError("Mirror already initialized; archive is only for first migration")
    revision = Revision(target, ref)
    files = revision.read(revision.tree)
    if any(n.startswith("archive/") for n in files):
        raise ValueError("Ref already contains archive; choose the pre-migration commit")
    for name, data in files.items():
        path = contained(target, ARCHIVE + "/" + name)
        if path.exists() and path.read_bytes() != data:
            raise ValueError(f"Refusing to overwrite existing archive: {name}")
    for name, data in files.items():
        path = contained(target, ARCHIVE + "/" + name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    print(f"Archived {len(files)} original files from {revision.sha}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["sync", "verify", "archive"])
    parser.add_argument("--source", type=Path)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--source-ref", default="HEAD")
    args = parser.parse_args()
    if args.command == "archive":
        archive(args.target, args.source_ref)
        return
    if args.source is None:
        parser.error("--source is required for sync/verify")
    if args.command == "sync":
        sync(args.source, args.target, args.source_ref)
    else:
        verify(args.source, args.target)


if __name__ == "__main__":
    main()
