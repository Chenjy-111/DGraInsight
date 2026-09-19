# DGraInsight Offline Evaluator

Download `DGraInsight-Offline-Evaluator.zip`, extract it, and double-click `Start-Evaluation.cmd`.

The package contains the current fixed-checkpoint relation-removal workflow, maintained DGraFormer/MSGNet/MTGNN plugins, the generic Thin Adapter contract, the paper-aligned StemGNN adapter example, reference profiles and documentation. It exports portable `evaluation.v1` results for website import.

Exact submitted datasets and checkpoints are bundled under `paper_resources/`.
Python and original model source trees are not bundled. The pinned CPU
requirements support Python 3.10 or 3.11. An existing original-model
environment may use another Python version only when it already provides
compatible PyTorch, NumPy and model-specific dependencies.

Retired pre-paper implementations and superseded external-model studies are not included.
