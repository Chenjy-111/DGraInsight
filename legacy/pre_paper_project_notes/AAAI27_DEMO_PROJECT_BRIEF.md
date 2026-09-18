# DGraInsight: AAAI-27 Demonstration Paper Project Brief

> Purpose: a compact, evidence-bounded context file for drafting an AAAI-27 Demonstration Program paper with ChatGPT or another writing assistant.
>
> Snapshot date: 2026-09-01 (Asia/Shanghai)
>
> Repository commit: `61c4b09b9fbcb09a394c000684f94b8473fe6b54`
>
> Important: the working tree was not clean when this brief was created (`src/App.tsx` modified, `src/components/CaseStudy.tsx` deleted, and `DGRAINSIGHT_REPORT_SCRIPT_CN.md` untracked). Treat this brief as a writing snapshot, not as a release tag.

## 1. Target venue: AAAI-27 Demonstration Program

Official call: <https://aaai.org/conference/aaai/aaai-27/demonstration-call/>

Official submission site: <https://openreview.net/group?id=AAAI.org/2027/Demonstration_Program>

Official author kit: <https://aaai.org/authorkit27/>

### Confirmed dates

- Final demo-paper deadline: **September 18, 2026, 11:59 PM AoE (UTC-12)**.
- Notification: **November 6, 2026**.
- Camera-ready deadline: **November 20, 2026**.
- Demonstration Program: **February 18–21, 2027**, Montréal, Canada.
- AAAI-27 as a whole is an in-person conference held February 16–23, 2027.

### Required submission materials

1. A **two-page short paper**, plus **one additional page containing references only**, in AAAI two-column format.
2. A demonstration video of **up to five minutes**. Slides may be submitted instead, but the call states that videos receive greater weight.
3. The video should preferably begin with a **30-second to one-minute overview**.

### Content and review rules

- The short paper must present the demonstration's technical details, related work, and significance.
- The paper must contain previously unpublished work.
- The work is judged on clarity, significance, relevance to the AI community, and ability to engage an audience.
- The demo should present a new idea rather than something already established in mainstream products or services.
- Either single-blind or double-blind submission is permitted for this track.
- The demo track does **not** require the AAAI reproducibility checklist.
- Open-sourcing the code is encouraged but is not mandatory.
- If accepted, authors must transfer the paper copyright to AAAI.
- At least one author must register, attend in person, and present the demonstration.
- AAAI supplies a standard monitor, table, power outlet, and poster board. Authors supply other equipment and materials.
- A backup mode, such as a laptop video or simulation, is expected in case the live system or special setup fails.

### Generative-AI policy

AAAI-27 permits judicious use of generative-AI tools in manuscript preparation, but human authors remain responsible for every submitted element. Plagiarism, nonexistent references, fabricated content, and cosmetic LLM rewrites used to create near-duplicate submissions are sanctionable. An AI system cannot be an author or a citable scholarly source. All technical statements and citations in the paper must therefore be independently verified by the human authors.

Policy source: <https://aaai.org/aaai-publications/aaai-publication-policies-guidelines/>

## 2. One-sentence project definition

**DGraInsight is an offline evidence-audit system that tests whether a learned graph relation in a multivariate forecasting model has a measurable functional effect on the predictions of a specified checkpoint.**

The system does not infer real-world causality. It audits model behavior under a declared structural intervention.

## 3. Problem and motivation

Learned-graph forecasting models expose adjacency matrices, attention weights, or dynamic graphs. These quantities show internal model structure, but a visually strong or high-weight edge is not automatically functionally important to a prediction.

Three gaps motivate DGraInsight:

1. A learned edge weight is a structural quantity, not functional evidence.
2. A prediction change after deleting one edge is uninterpretable without comparison against suitable control-edge deletions.
3. Inspecting many edges and reporting only favorable cases creates selection and multiple-testing problems.

Safe central claim:

> DGraInsight advances learned-graph inspection from visualizing internal structure to auditing checkpoint-specific functional dependence under an explicit intervention and control protocol.

## 4. System contributions suitable for the demo paper

The two-page paper should emphasize three contributions rather than attempting to describe every implementation detail.

### Contribution 1: precise graph-relation intervention

The interface preserves the selected model, sample, graph context, source node, and target node and passes that exact selection to the offline audit. The adapter deletes the selected directed relation and reruns the same checkpoint.

### Contribution 2: evidence relative to matched controls

For the selected relation, the system computes a focal prediction response and compares it with all unique eligible control-edge responses. The current declared response metric is `prediction_delta_abs`.

For a case:

`D = focal response - mean(control responses)`

A positive case-level `D` is descriptive only. It is not a p-value, statistical significance result, or causal conclusion.

### Contribution 3: portable and validated evidence sessions

Both quick and formal audits emit Portable Audit Session v2. The browser validates and renders the session without rerunning a neural network or recomputing formal statistics. This separates expensive and environment-sensitive model execution from lightweight evidence review.

## 5. Architecture and workflow

Recommended paper-level workflow description:

1. **Input:** model source, configuration, checkpoint, dataset, and audit protocol.
2. **Discover:** expose graph relations in the model's native graph context.
3. **Select:** lock a sample, context, source node, and target node.
4. **Test:** remove the exact selected relation and rerun the same checkpoint.
5. **Validate:** compare the focal response with unique eligible control interventions; in formal mode, aggregate over a frozen family and perform declared inference.
6. **Output:** generate a validated Portable Audit Session v2 for browser-based exploration.

The Python layer runs models, extracts native graphs, performs interventions, constructs controls, and performs formal inference. The React/TypeScript browser application validates and visualizes the resulting Session v2 artifact.

## 6. Adapter design

DGraInsight separates model-specific graph semantics from a shared audit core.

Maintained reference adapters:

- **DGraFormer:** window-level graph context.
- **MSGNet:** scale-level graph context.
- **MTGNN:** global learned-graph context.

Additional models can be integrated through an explicit Adapter Contract. Passing adapter conformance enables Quick Inspection but does not automatically authorize Formal Evidence Audit. Formal audit additionally requires a separately declared and validated sample protocol, candidate family, control protocol, dependence treatment, and inference procedure.

## 7. Two audit modes

### Quick Inspection

- Real checkpoint-backed, single-case workflow.
- Validates model/data/checkpoint compatibility and intervention hooks through V01–V09.
- Discovers native graph edges and performs the focal and control interventions.
- Emits Session v2.
- Formal inference is explicitly not evaluated; case-level p-values and q-values must remain absent.

### Formal Evidence Audit

- Uses predeclared samples/tests and frozen candidate-hypothesis families.
- Requires the model-side validations plus V10 statistical-protocol validation and V11 family validation.
- Stores candidate-level responses across audit units.
- Uses a declared dependence-aware primary inference method.
- Applies Benjamini–Hochberg correction within each frozen hypothesis family.
- A candidate is `Supported` only when its corrected q-value is below the declared alpha (currently 0.05).

Status language must remain precise:

- `Supported`: evidence established under the frozen protocol after correction.
- `Not supported`: the audit did not establish consistent evidence under this protocol; this does not prove the edge is useless.
- `Not audited`: the exact relation/scope was not in the frozen candidate family.
- `Unavailable`: a candidate exists but the conditions for formal inference were not met.

## 8. Frozen evidence currently reported by the repository

These results are scoped to the named checkpoints, datasets, candidates, samples, interventions, and frozen protocols.

- **DGraFormer / ETTh1:** 1 of 8 single-window candidates and 1 of 4 all-retained-window candidates are supported.
- **MSGNet / ETTh1:** 27 of 126 single-scale candidates and 14 of 42 all-scale candidates are supported.

Highlighted DGraFormer examples documented for the live demonstration:

- `W6 · HUFL → LUFL`: single-window candidate reported as supported; BH-adjusted q approximately 0.00880, mean D approximately +0.000962, active/planned units 28/40.
- `HUFL → MUFL` over all retained windows: reported as supported; BH-adjusted q approximately 0.000400, mean D approximately +0.001246, active/planned units 28/40.

Highlighted MTGNN Quick Inspection example:

- Model/dataset: MTGNN / Exchange-Rate.
- Selected global relation: `0 → 6`.
- Focal response: 0.0001971803.
- Number of controls: 27.
- Control mean: 0.0002866629.
- D: -0.0000894826.
- Interpretation: the target deletion changed the prediction less than the mean control deletion in this case. Because this is Quick Inspection, no case-level p-value or q-value is valid.

Before final submission, copy all numerical values directly from validated Session v2 artifacts rather than from this prose brief.

## 9. Recommended live-demo story

The paper and video should use one coherent audience journey:

1. Open the built-in DGraFormer/ETTh1 Formal Evidence Audit.
2. Show a learned graph and explain why visual edge strength alone is insufficient.
3. Select `HUFL → LUFL` in window W6.
4. Show the exact intervention, control comparison, mean D, q-value, and supported status.
5. Switch scope or candidate to illustrate that local-window and all-window hypotheses are distinct.
6. Import the MTGNN Quick Session to demonstrate portability and model extensibility.
7. Show that the interface explicitly withholds formal p/q values for a single-case Quick Inspection.
8. End on provenance, validation, and interpretation boundaries.

This sequence demonstrates interaction, technical novelty, and responsible interpretation within five minutes.

## 10. Claims that are safe and claims to avoid

### Safe formulations

- "functional evidence for checkpoint-specific model dependence"
- "a structural intervention on a learned directed relation"
- "supported under the declared frozen audit protocol"
- "a portable, schema-validated evidence session"
- "the browser validates and renders stored evidence"
- "the adapters preserve each model's native graph semantics"

### Do not write

- "DGraInsight discovers true causal relations between variables."
- "A supported edge is universally important."
- "A not-supported edge has no effect."
- "Quick Inspection proves statistical significance."
- "The browser reruns the model or computes p-values."
- "All models become formally auditable after implementing an adapter."
- "The repository is already a complete, publication-ready open-source release."

## 11. Reproducibility and implementation state

Documented prerequisites:

- Python 3.9.
- Node.js 20 or newer.
- npm.

Documented verification commands:

```text
python -m pip install -r requirements.txt
npm ci
python -m unittest discover -s tests -p "test_*.py"
npm run test:web-session-v2
npm run test:web-graph-regression
npm run build
```
The formal configurations are:

- `configs/formal_audit_v2_dgraformer_etth1_frozen40.json`
- `configs/formal_audit_v2_msgnet_etth1_frozen14.json`

The principal built-in evidence sessions are:

- `public/data/evidence/dgraformer_etth1_session_v2.json`
- `public/data/evidence/msgnet_etth1_session_v2.json`

The MTGNN quick-demo fixture is:

- `tests/fixtures/mtgnn_quick_session_v2.json`

This brief did not rerun the complete test suite. Do not state that all tests passed on the submission snapshot until the suite is rerun and its output is recorded.

## 12. Release and artifact limitations

- Raw third-party datasets, local checkpoints, upstream model source trees, secrets, and local environments are not included in the repository.
- Live Quick Inspection requires users to obtain the relevant model source, checkpoint, and dataset and verify their hashes.
- The repository currently reports that it does not have an owner-approved `LICENSE` or a verified `CITATION.cff`.
- Until those governance issues are resolved, avoid describing the repository as a finalized open-source artifact. A safer statement is that the implementation and validated session artifacts support local reproducibility subject to third-party assets and release governance.

## 13. Source hierarchy for writing

Use sources in this order when statements conflict:

1. Current v2 code, schemas, configs, validated Session v2 artifacts, and tests.
2. Root `README.md` and `docs/REPRODUCIBILITY.md`.
3. Current v2 protocol and adapter documents.
4. `DGRAINSIGHT_REPORT_SCRIPT_CN.md` as a presentation-oriented explanation.
5. Historical Phase 0/Phase 1 audit documents only for provenance history, not as the current system state.

In particular, older documents that say a checkpoint-forward phase was still pending describe an earlier audit stage. Do not merge those historical statements with the current v2 formal-audit claims without checking dates and artifacts.

## 14. Recommended two-page paper structure

### Title

Working title:

**DGraInsight: Auditing Functional Evidence in Learned Forecasting Graphs**

### Abstract

Approximately 90–120 words: problem, system, interaction, evidence protocol, and demo value.

### 1. Introduction

- Learned graph visualization is not functional evidence.
- State the precise audit question.
- List the three contributions concisely.

### 2. DGraInsight Workflow

- One overview figure should carry most of the architecture explanation.
- Describe selection preservation, exact intervention, matched controls, formal inference, and Session v2.
- Mention adapters without spending space on model-specific implementation details.

### 3. Interactive Demonstration

- Describe the DGraFormer formal-evidence walkthrough.
- Use the MTGNN Quick Session briefly to demonstrate portability and evidence-mode separation.
- State what participants can inspect and manipulate.

### 4. Evidence Boundary and Conclusion

- State checkpoint/data/protocol scope.
- Explicitly deny real-world causal interpretation.
- End with the contribution to reliable inspection of learned graph models.

References must be placed on the references-only third page. The paper still needs a compact, verified related-work set covering learned graph forecasting, graph intervention/ablation, statistical multiple testing, and visual analytics or explainable AI systems.

## 15. Suggested overview figure

A single combined figure is preferable to multiple small screenshots:

```text
Checkpoint + Dataset
        ↓
Native Graph Adapter
        ↓
Select sample/context/source/target
        ↓
Exact focal deletion ── Matched control deletions
        ↓
Case D / Frozen-family inference + BH
        ↓
Portable Audit Session v2
        ↓
Validated interactive browser view
```

Use real interface screenshots and plots derived from validated artifacts. Do not use generative AI to invent scientific plots or alter displayed numerical evidence.

## 16. Information still needed from the authors

Before a submission-ready paper can be finalized, confirm:

- Final author list, affiliations, and preferred blind-review mode.
- Whether the submission will be single-blind or double-blind.
- Exact public artifact URL, if any, and whether the license will be resolved before submission.
- Which DGraFormer checkpoint and protocol identifier should appear in the paper.
- Whether all frozen numbers have been revalidated on the final snapshot.
- Final system screenshot and overview figure.
- Six to ten verified scholarly references; no generated or unverified citations.
- Funding, conflict, ethics, and institutional disclosure requirements.
- Final AI-use disclosure, if the authors or institution require one.

## 17. Copyable instruction for ChatGPT web

```text
Use the attached project brief as the evidence boundary for an AAAI-27 Demonstration Program paper. Draft in concise professional academic English using the AAAI two-column format assumptions: two content pages plus one references-only page. Focus on a live, engaging system demonstration rather than presenting DGraInsight as a full benchmark paper. Use only claims supported by the brief, preserve the distinction between Quick Inspection and Formal Evidence Audit, and never describe model dependence as real-world causality. Do not invent citations, numerical results, experiments, availability claims, or implementation details. Mark every location that still requires an author decision or verified citation with [AUTHOR VERIFY]. First produce (1) a claim-evidence outline and estimated space allocation, then (2) a complete draft, then (3) a list of all factual claims and their supporting project source.
```
