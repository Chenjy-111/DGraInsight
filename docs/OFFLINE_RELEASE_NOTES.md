Download **DGraInsight-Offline-Evaluator.zip**, extract it, and double-click **Start-Evaluation.cmd**.

- Local paths entered in an English wizard; no manual config editing.
- DGraFormer, MSGNet, MTGNN and a generic external adapter route.
- Current edge-removal evaluator with incremental recovery journal and resume.
- Python environment detection, CPU environment preference and explicit crash diagnostics.
- External source ZIPs do not require Git metadata; actual source hashes are recorded.
- Output: `runs/<timestamp>/manifest.json`, ready for website import.

**AGCRN-Adapter.zip** is an optional, separate external model example. It is not required for other models.
**SHA256SUMS.txt** contains checksums for both downloads.

Requires an existing Python 3.10+ environment with PyTorch, NumPy and the chosen model's dependencies. Python, datasets and checkpoints are not bundled. The Source code archives are for developers.
