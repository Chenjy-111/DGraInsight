# `performance.v1`

The website loads `public/data/performance/v1/dgraformer.json` and `msgnet.json` through `src/data/performance.ts`. These files contain the current built-in fixed-checkpoint relation-removal results.

Each record identifies a sample, native context, source, target and removal scope. A single-context record removes one relation in one native context. An all-context record removes that relation from every relevant native context in one run. Every run starts from the original graph and reruns the full forecast; removals are not cumulative.

Select a relation before reading its summary. Samples, graph contexts, removal scopes and highlighted edges remain synchronized. MSGNet scale indices are not time windows, and its `G0–G6` graph nodes are latent positions rather than named ETTh1 output variables.

The forecast-step view averages output errors at each step for the selected sample. The cross-sample view averages all steps and outputs within each available sample. Missing removals remain unavailable and are excluded from displayed denominators.

The UI stores signed error change as `after - before`, so negative values indicate improved error and positive values indicate degraded error. It also reports improvement as `(before - after) / before`, matching the paper's improvement-oriented sign convention. The 0.1% baseline-relative threshold labels small changes descriptively; it does not establish significance or equivalence.

Run `npm run test:performance` to verify record identities, formulas, classification and coverage. Run `python scripts/verify_performance_v1.py` to recompute metrics from the saved raw arrays.
