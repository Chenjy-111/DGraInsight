# External-model candidate screen — 2026-09-14

## Decision

Keep AGCRN as the existing engineering integration study. StemGNN passes the initial
native-intervention and response-separation screen, but is **not yet selected as the final
paper showcase**: this short-trained checkpoint loses to a last-value persistence baseline.
Graph WaveNet and GTS received source-level screening only; no numerical response claims
are made for either. No generic runner, adapter contract, UI, or AGCRN files were changed.

## Candidate comparison

| Candidate | Native relation and removal boundary | Main issue | Current status |
| --- | --- | --- | --- |
| StemGNN | Mask both attention entries at the graph-attention dropout output; original forward performs batch mean, degree, symmetrization, Laplacian and Chebyshev computations | Undirected relation; graph depends on inference batch; legacy FFT APIs; training quality needs improvement | 25-node real-data training and 1,500 removals completed |
| Graph WaveNet | Adaptive softmax support is appended to support list; a GCN forward pre-hook can replace this support before native graph convolution | Must declare layer/all-layer scope, optional row renormalization and whether fixed supports remain; original code has legacy Conv1d usage | Feasible source-level backup; untrained/untested here |
| GTS | Hard Gumbel graph after diagonal masking, before encoder/decoder diffusion | Forward samples even in eval; matched random state is essential. Returned probabilities differ from the consumed binary graph, so weights cannot be conflated | Lower priority; untrained/untested here |

Official sources: [StemGNN model at pinned revision](https://github.com/microsoft/StemGNN/blob/dc7dea6842c20c5dcece2f18b435e26770b3421c/models/base_model.py),
[StemGNN data instructions](https://github.com/microsoft/StemGNN/blob/dc7dea6842c20c5dcece2f18b435e26770b3421c/README.md),
[Graph WaveNet model](https://github.com/nnzhan/Graph-WaveNet/blob/master/model.py),
[GTS model](https://github.com/chaoshangcs/GTS/blob/master/model/pytorch/model.py).

## StemGNN experiment and semantics

- Source revision: `dc7dea6842c20c5dcece2f18b435e26770b3421c`.
- Real JHU daily confirmed counts, 25 countries corresponding to the official list.
  Aliases resolved explicitly (UK, Arab and Korea to United Kingdom, United Arab Emirates
  and Korea, South). Provinces are summed by country; dates are 2020-01-23 through
  2020-12-31, differenced from cumulative counts. All 17 negative reporting corrections
  are retained. This is an extended-date custom experiment, not the paper's 110-day split.
- Chronological row split: 206 train / 69 validation / 69 test. Scaler fits training only.
  No cross-split windows. Window/horizon = 28/28; 151/14/14 available windows.
- Original Model forward, 2 stock blocks, `multi_layer=1`, seed 0, Adam 0.001,
  60 epochs, batch 32. Checkpoint selected solely by raw validation MAE.
  No official pretrained checkpoint was used.
- Only model-source substitutions: legacy `torch.rfft`/`torch.irfft` to corresponding
  `torch.fft.fft`/`ifft` operations. This was run with PyTorch 2.14.0+cpu; no cross-version
  numerical equivalence to historical PyTorch 1.7.1 is claimed.
- A forward hook on `model.dropout` masks both `(u,v)` and `(v,u)` in the attention
  output. No graph-to-spectral logic is copied into the operational intervention.
  Original code computes degree **before** symmetrization; this order is preserved.
  No extra softmax or row normalization is applied after deletion.
- Weight is the original forward's symmetric attention entry, not the Laplacian or
  Chebyshev coefficient. Relations are undirected. MAE averages all 28 × 25 outputs
  after inverse training normalization, in daily-case count units.
- Evaluation batch size is fixed to 1 because original StemGNN averages attention
  across the batch. Removal scope is the shared graph consumed by both stock blocks.
- Five evenly spaced test-window indices: 0, 3, 6, 9, 13. All 300 unordered, non-self
  relations per window are screened. Windows overlap; results are descriptive, not
  independent statistical trials or a causal analysis of countries.

## Results

| Statistic | Value |
| --- | ---: |
| Number of removals | 1,500 |
| Median absolute relative MAE change | 0.05218% |
| 90th percentile absolute relative MAE change | 0.36860% |
| Maximum absolute relative MAE change | 10.06845% |
| Fraction above 0.1% absolute relative change | 33.27% |
| Mean model baseline MAE, five screened windows | 14,814.05 |
| Mean last-value persistence MAE, same windows | 6,555.97 |

The 0.1% threshold is descriptive, not a significance test. The weak baseline model
prevents interpreting large intervention responses as evidence of a high-quality forecasting
model. Response separation is sufficient to prioritize further training, not to skip it.

## Verified illustrative pair

Same checkpoint, test-window index 9: input starts 2020-11-02, prediction starts
2020-11-30. Baseline MAE = 15314.643523622679.

| | Undirected relation | Symmetric attention weight | Delta MAE | Relative delta MAE |
| --- | --- | ---: | ---: | ---: |
| A | Ecuador — South Korea | 0.12404979020357132 | +2.7807655454453197 | +0.018157559731351355% |
| B | US — France | 0.08266594260931015 | +717.6669316715779 | +4.686148460227521% |

`wA / wB = 1.5006154444`; `abs(deltaB) / abs(deltaA) = 258.0825028`.
Selection was post-hoc: same window, weight ratio >=1.5, A relative response between
0.001% and 0.05%, B relative response >=1%; maximize B response. Both changes are positive.

## Verification and artifacts

- Identity hook equals native forward exactly for all five windows.
- Both removed symmetric entries are zero; every other symmetric graph entry is
  unchanged for every removal.
- Independent graph preparation (preserving the exact native operation order) and the
  operational hook produce identical full predictions for the strongest response in
  each sampled window, plus both selected pair members. Both stock blocks' actually
  consumed supports match the independent expected tensor exactly.
- All 1,500 stored baseline/after MAEs were recomputed from hashed raw arrays;
  maximum discrepancy = 5.46e-12. The pair predictions were rerun from the saved
  checkpoint; raw-scale difference from stored operands <=1.82e-12.
- Raw/source/checkpoint hashes, training history, distributions and exact pair data:
  `outputs/stemgnn_screening/{sources,report,records,showcase_pair}.json`.
- Checkpoint: `outputs/stemgnn_screening/screen_checkpoint.pt`.
- All raw operands: `outputs/stemgnn_screening/operands.npz`.
- Scripts: `scripts/screen_stemgnn.py`, `scripts/verify_stemgnn_screen.py`.
  From repository root, use the local `.tmp/stemgnn-env/Scripts/python.exe` to run them.
  Screening retrains and replaces this exploratory output; verification does not retrain.

Next gate for the final showcase: improve/validate prediction quality without selecting
checkpoints by intervention response, repeat the screen on the resulting checkpoint,
then implement the six-method Thin Adapter with explicit undirected semantics and
unchanged generic core. The existing contract declares `directed`, but this screen has
not yet established end-to-end undirected rendering support in the generic UI.
