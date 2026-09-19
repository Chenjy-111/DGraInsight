import hashlib
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
RESOURCE_ROOT = ROOT / "paper_resources"


class PaperResourceTests(unittest.TestCase):
    def test_manifest_files_match_declared_sha256(self):
        manifest = json.loads((RESOURCE_ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["version"], "paper-resources.v1")
        self.assertEqual(len(manifest["files"]), 7)

        for entry in manifest["files"]:
            path = RESOURCE_ROOT / entry["path"]
            self.assertTrue(path.is_file(), entry["path"])
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            self.assertEqual(digest, entry["sha256"], entry["path"])

    def test_sha256sums_matches_manifest(self):
        manifest = json.loads((RESOURCE_ROOT / "manifest.json").read_text(encoding="utf-8"))
        expected = {entry["path"]: entry["sha256"] for entry in manifest["files"]}
        actual = {}
        for line in (RESOURCE_ROOT / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
            digest, path = line.split("  ", 1)
            actual[path] = digest
        self.assertEqual(actual, expected)


if __name__ == "__main__":
    unittest.main()
