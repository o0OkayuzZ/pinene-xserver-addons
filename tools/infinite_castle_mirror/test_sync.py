import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("castle_sync", Path(__file__).with_name("sync.py"))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / "source"
        self.target = Path(self.temp.name) / "mirror"
        self.source.mkdir()
        self.target.mkdir()
        self.git("init", "-q")
        self.git("config", "user.name", "Test")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "core.autocrlf", "false")
        self.config = json.loads(Path(__file__).with_name("config.json").read_bytes())
        self.write(sync.CONFIG, json.dumps(self.config))
        for index, pack in enumerate(self.config["packs"]):
            self.write(f"packs/p{index}/manifest.json", json.dumps({"header": {"uuid": pack["uuid"]}}))
            self.write(f"packs/p{index}/data.bin", b"\x00binary\r\n\xff")
        for name in self.config["files"]:
            self.write(name, name + "\n")
        self.commit()

    def git(self, *args):
        return sync.git(self.source, *args)

    def write(self, name, data):
        path = self.source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data.encode() if isinstance(data, str) else data)

    def commit(self):
        self.git("add", "-A")
        self.git("commit", "-qm", "fixture")

    def run_sync(self):
        return sync.sync(self.source, self.target, "HEAD")

    def snapshot(self):
        return {p.relative_to(self.target).as_posix(): p.read_bytes()
                for p in self.target.rglob("*") if p.is_file()}

    def test_identical_and_unrelated_commit_are_noops(self):
        self.assertTrue(self.run_sync())
        before = self.snapshot()
        self.assertFalse(self.run_sync())
        self.write("unrelated.txt", "not exported")
        self.commit()
        self.assertFalse(self.run_sync())
        self.assertEqual(before, self.snapshot())

    def test_deletions_and_additions_preserve_unowned_docs(self):
        self.run_sync()
        for path in ("docs/local.md", "development/reference.md", "archive/old/data", "snapshot-files.json"):
            p = self.target / path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b"keep")
        (self.source / "packs/p0/data.bin").unlink()
        self.write("packs/p0/new.dat", "new")
        self.commit()
        self.run_sync()
        self.assertFalse((self.target / "behavior_packs/infinite_castle/data.bin").exists())
        self.assertEqual((self.target / "behavior_packs/infinite_castle/new.dat").read_bytes(), b"new")
        self.assertEqual((self.target / "development/reference.md").read_bytes(), b"keep")
        self.assertEqual((self.target / "docs/local.md").read_bytes(), b"keep")
        self.assertEqual((self.target / "archive/old/data").read_bytes(), b"keep")
        self.assertEqual((self.target / "snapshot-files.json").read_bytes(), b"keep")

    def test_uuid_follows_source_directory_move(self):
        self.run_sync()
        self.git("mv", "packs/p0", "packs/renamed")
        self.commit()
        self.run_sync()
        meta = json.loads((self.target / sync.METADATA).read_bytes())
        self.assertEqual(meta["resolved_packs"]["behavior_packs/infinite_castle"], "packs/renamed")

    def test_missing_uuid_fails_before_mutation(self):
        self.run_sync()
        before = self.snapshot()
        (self.source / "packs/p0/manifest.json").unlink()
        self.commit()
        with self.assertRaisesRegex(ValueError, "must resolve once"):
            self.run_sync()
        self.assertEqual(before, self.snapshot())

    def test_ambiguous_uuid_fails_before_mutation(self):
        self.run_sync()
        before = self.snapshot()
        self.write("another/manifest.json", (self.source / "packs/p0/manifest.json").read_bytes())
        self.commit()
        with self.assertRaisesRegex(ValueError, "must resolve once"):
            self.run_sync()
        self.assertEqual(before, self.snapshot())

    def test_verifier_detects_tampering_and_sync_repairs_it(self):
        self.run_sync()
        p = self.target / "behavior_packs/infinite_castle/data.bin"
        p.write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "Mirror differs"):
            sync.verify(self.source, self.target)
        self.run_sync()
        extra = p.with_name("unapproved.txt")
        extra.write_bytes(b"extra")
        with self.assertRaisesRegex(ValueError, "Mirror differs"):
            sync.verify(self.source, self.target)
        self.run_sync()
        self.assertFalse(extra.exists())

    def test_source_worktree_changes_do_not_leak(self):
        self.write("packs/p0/data.bin", "uncommitted")
        self.run_sync()
        self.assertEqual((self.target / "behavior_packs/infinite_castle/data.bin").read_bytes(), b"\x00binary\r\n\xff")

    def test_unsafe_target_rejected(self):
        self.config["packs"][0]["target"] = "../outside"
        self.write(sync.CONFIG, json.dumps(self.config))
        self.commit()
        with self.assertRaisesRegex(ValueError, "Unsafe relative path"):
            self.run_sync()
        self.assertEqual(self.snapshot(), {})

    def test_forged_hash_metadata_rejected(self):
        self.run_sync()
        p = self.target / sync.METADATA
        meta = json.loads(p.read_bytes())
        meta["files"] = {}
        p.write_text(json.dumps(meta))
        with self.assertRaisesRegex(ValueError, "Invalid or mismatched"):
            sync.verify(self.source, self.target)

    def test_initial_migration_requires_lossless_archive(self):
        sync.git(self.target, "init", "-q")
        sync.git(self.target, "config", "user.name", "Test")
        sync.git(self.target, "config", "user.email", "test@example.invalid")
        sync.git(self.target, "config", "core.autocrlf", "false")
        (self.target / "README.md").write_bytes(b"historical README")
        sync.git(self.target, "add", "-A")
        sync.git(self.target, "commit", "-qm", "old mirror")
        with self.assertRaisesRegex(ValueError, "Run archive command"):
            self.run_sync()
        sync.archive(self.target, "HEAD")
        self.run_sync()
        self.assertEqual((self.target / sync.ARCHIVE / "README.md").read_bytes(), b"historical README")


if __name__ == "__main__":
    unittest.main()
