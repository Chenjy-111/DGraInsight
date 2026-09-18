# Evaluator engine

`dgraudit` is the current engine used by the DGraInsight Offline Evaluator. It validates explicit model resources, executes fixed-checkpoint relation removals, computes MAE/MSE, and writes portable `evaluation.v1` results.

Maintained plugins are DGraFormer, MSGNet and MTGNN. External models use `thin_adapter.py`. The engine contains no retired pre-paper workflow.
