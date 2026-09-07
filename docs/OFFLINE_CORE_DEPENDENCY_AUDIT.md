# Offline core dependency audit

Audit stage: after generic migration, before external-model adapter implementation.
Existing scientific assets and the two specialized built-in workspaces are retained.

| Layer | Files / responsibilities | Model dependencies | Decision |
|---|---|---|---|
| Generic Core | `dgraudit/evaluation.py`: metrics, evidence, sequential runner, atomic resume | Python standard library only; no model-name branch, tensor framework or adjacency edit | Keep |
| Generic Core | `dgraudit/thin_adapter.py`: six-method API and function bridge | Opaque native Sample.input; standard library | Keep |
| Generic Core | `dgraudit/evaluation_validation.py`: six preflight checks, identities and capability rejection | Only portable evidence types and callbacks; no adjacency edit | Keep |
| Generic Core / CLI | `dgraudit/cli/evaluate.py`, `dgrainsight/*` | Dispatches to plugin/loader boundary; no model-specific calculation | Keep |
| Plugin Layer | `dgraudit/evaluation_plugins.py` | Built-in names DGraFormer, MSGNet, MTGNN and external module/class loading. Torch imported only inside maintained plugin factory. Source-specific graph semantics remain here. | Isolated; never add an external-model branch |
| Plugin Layer | `dgraudit/adapters.py`, `dgraudit/validation.py`, `integrations/mtgnn_external/*` | Existing native adapters/specs; framework and dataset requirements | Reuse maintained implementations; not Generic Core |
| Generic Web | `src/data/evaluation.ts`, `src/components/EvaluationWorkspace.tsx` | `evaluation.v1` only; independent nodes/outputs; optional weights/arrays; no model branch | Keep |
| Web routing / plugin presentation | `AuditSessionImport.tsx`, `useAuditSessionStore.ts`, `App.tsx` | Imports evaluation.v1; maintained MTGNN reference button; returns to specialized UI | Freeze during external experiment |
| Specialized Web | existing DGraFormer/MSGNet workspaces, graph viewers, `performance.v1` assets | Intentional model-specific native graph displays | Preserve and regression-test |
| Legacy | historical audit/wizard, `dgraudit/v2`, Session v2 statistical audit, old docs | Controls, D and formal inference in archival workflow | Retain explicitly Legacy; not new runner dependency |

## Boundary findings

The old exported `dgraudit.AdapterCapabilities` belongs to historical native adapters.
New users import `dgraudit.thin_adapter.AdapterCapabilities`; the names are intentionally
in separate modules for compatibility. Generic imports do not trigger NumPy/PyTorch.
The public `dgrainsight` package delegates to existing evaluation code; it introduces no
second runner or evidence schema. External model identifiers are metadata strings.

The generic core compares finite predictions and metrics, never guesses whether an array
uses [source,target] or [target,source]. Native direction, insertion point, self-loops,
normalization, gates, layers and residual paths are adapter responsibilities. A single
thin adapter may truthfully declare only single-context support. Importing results never
requires the original model. A shared schema does not imply shared intervention semantics.

## Freeze boundary

The BEFORE_EXTERNAL_MODEL commit fixes the generic core, schema, loader, maintained plugins,
Web, fixture and migration docs. The subsequent study must add only an external integration,
configuration, validation artifacts, study tests and reports. Compare **all** `dgraudit/`,
`dgrainsight/`, `src/`, `schemas/` paths plus package.json against the baseline commit;
report any difference rather than narrowing the core definition after the experiment.
