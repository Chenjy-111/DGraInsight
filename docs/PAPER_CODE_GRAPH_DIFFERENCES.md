# Native graph semantics

Graph views follow tensors consumed by the named model. A displayed relation is an internal computational relation and does not establish real-world causality.

## DGraFormer

DGraFormer exposes window-level graphs over observed ETTh1 variables. Relation removal occurs before native graph normalization; normalization is recomputed and the full forecast is rerun. Single-window and all-relevant-window scopes are distinct experiments.

## MSGNet

MSGNet exposes scale-level adaptive graphs over latent positions `G0–G6`. These positions must not be relabeled as ETTh1 variables, and scales must not be described as consecutive time windows. The public source→target direction maps to the native matrix entry consumed for that message direction. Single-scale and all-scale scopes preserve MSGNet's native execution order.

## MTGNN

MTGNN exposes one global learned graph. The shared adjacency is used by both native graph-convolution branches, so its removal is a coupled shared-relation intervention rather than an isolated real-world directed effect.

## External adapters

An external adapter must declare node meanings, graph contexts, relation directionality, measurement space and the exact native removal point. Graph-node count need not equal forecast-output count. See the [Thin Adapter guide](../offline_app/ADAPTER_GUIDE.md).
