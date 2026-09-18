import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from integrations.agcrn_external.agcrn_adapter import source_revision


class SourceRevisionTests(unittest.TestCase):
    def test_export_inside_parent_repository_does_not_inherit_revision(self):
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory)
            (parent / ".git").mkdir()
            root = parent / "export"
            root.mkdir()
            with patch("subprocess.check_output") as command:
                self.assertIsNone(source_revision(root))
                command.assert_not_called()

    def test_git_checkout_and_worktree(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for worktree in (False, True):
                marker = root / ".git"
                if worktree:
                    marker.write_text("gitdir: elsewhere")
                else:
                    marker.mkdir()
                with patch("subprocess.check_output", return_value="abc123\n"):
                    self.assertEqual(source_revision(root), "abc123")
                if worktree:
                    marker.unlink()
                else:
                    marker.rmdir()

    def test_missing_broken_or_unresponsive_git_is_optional(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".git").mkdir()
            for error in (FileNotFoundError(), subprocess.CalledProcessError(128, "git"),
                          subprocess.TimeoutExpired("git", 5)):
                with self.subTest(error=type(error).__name__):
                    with patch("subprocess.check_output", side_effect=error):
                        self.assertIsNone(source_revision(root))
