"""Prepare the pinned official project and verified real dataset; never replace user edits."""
import hashlib
import json
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT / "third_party/AGCRN"
REVISION = "7fbbf2aeb099242098a3cf482b55cd45d7295c28"
config = json.loads((ROOT / "configs/evaluation_agcrn_external.json").read_text())
if not REPO.exists():
    subprocess.run(["git", "clone", "https://github.com/LeiBAI/AGCRN.git", str(REPO)], check=True)
    subprocess.run(["git", "-C", str(REPO), "checkout", REVISION], check=True)
actual = subprocess.check_output(["git", "-C", str(REPO), "rev-parse", "HEAD"], text=True).strip()
if actual != REVISION:
    raise RuntimeError("Existing AGCRN checkout has a different revision; choose a separate pinned checkout.")
patch = Path(__file__).with_name("native_hook.patch")
check = subprocess.run(["git", "-C", str(REPO), "apply", "--check", str(patch)], capture_output=True)
if check.returncode == 0:
    subprocess.run(["git", "-C", str(REPO), "apply", str(patch)], check=True)
else:
    subprocess.run(["git", "-C", str(REPO), "apply", "--reverse", "--check", str(patch)], check=True)
path = REPO / "data/PeMSD8/pems08.npz"
if not path.exists():
    path.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve("https://raw.githubusercontent.com/Davidham3/ASTGCN-2019-mxnet/master/data/PEMS08/pems08.npz", path)
assert hashlib.sha256(path.read_bytes()).hexdigest() == config["dataset"]["sha256"], "Dataset hash mismatch; no substitution allowed"
assert hashlib.sha256(Path(__file__).with_name("checkpoint.pth").read_bytes()).hexdigest() == config["checkpoint"]["sha256"], "Checkpoint hash mismatch"
print("Pinned AGCRN source, small native hook, dataset and checkpoint verified.")
