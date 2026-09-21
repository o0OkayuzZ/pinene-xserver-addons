import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("ownership", Path(__file__).parents[1] / "audit_pack_ownership.py")
ownership = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ownership)


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.packs = [self.root / "behavior_packs/bp", self.root / "resource_packs/rp"]
        for uid, pack in zip(("bp", "rp"), self.packs):
            self.write(pack / "manifest.json", {"header": {"uuid": uid, "version": [1, 0, 1]}, "modules": [{"version": [1, 0, 1]}], "dependencies": []})
        for folder in (self.root, self.root / "worlds/Bedrock level"):
            for kind, uid in (("behavior", "bp"), ("resource", "rp")):
                self.write(folder / f"world_{kind}_packs.json", [{"pack_id": uid, "version": [1, 0, 1]}])

    def write(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")

    def errors(self):
        return ownership.metadata_errors(self.root, self.packs)

    def test_matching_metadata_passes(self):
        self.assertEqual(self.errors(), [])

    def test_stale_nested_world_registration_fails(self):
        self.write(self.root / "worlds/Bedrock level/world_behavior_packs.json", [{"pack_id": "bp", "version": [1, 0, 0]}])
        self.assertTrue(any("Stale registration" in error for error in self.errors()))

    def test_missing_registration_fails(self):
        self.write(self.root / "world_resource_packs.json", [])
        self.assertTrue(any("registrations differ" in error for error in self.errors()))

    def test_stale_dependency_and_module_fail(self):
        path = self.packs[0] / "manifest.json"
        data = json.loads(path.read_text())
        data["dependencies"] = [{"uuid": "rp", "version": [1, 0, 0]}]
        data["modules"][0]["version"] = [1, 0, 0]
        self.write(path, data)
        errors = self.errors()
        self.assertTrue(any("dependency/version" in error for error in errors))
        self.assertTrue(any("Module version" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
