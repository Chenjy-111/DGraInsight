# Paper resources

This directory contains the exact fixed checkpoints and datasets referenced by
the submitted DGraInsight artifact. Every file is identified by SHA-256 in
[`manifest.json`](manifest.json) and [`SHA256SUMS`](SHA256SUMS). Run the integrity
test from the repository root before a checkpoint-backed evaluation:

```bash
python -m unittest tests.test_paper_resources
```

## Included files

| File | Purpose |
|---|---|
| `checkpoints/dgraformer_etth1.pth` | DGraFormer checkpoint used for the ETTh1 paper-facing results |
| `checkpoints/msgnet_etth1.pth` | MSGNet checkpoint used for the ETTh1 paper-facing results |
| `checkpoints/mtgnn_exchange.pt` | MTGNN state dictionary used by the maintained Exchange-Rate integration |
| `checkpoints/stemgnn_covid19.pt` | StemGNN checkpoint used for the paper's external-model example |
| `data/ETTh1.csv` | ETTh1 dataset used by DGraFormer and MSGNet |
| `data/exchange_rate.txt` | Exchange-Rate dataset used by the MTGNN integration |
| `data/covid25_daily_2020.csv` | Processed 25-country JHU CSSE series used by the StemGNN example |

The checkpoint filenames are normalized for reviewer use; their hashes match
the identities already recorded in the public result and evaluation files.
Original model source trees are not duplicated here. Use the pinned upstream
revisions and adapter instructions in the
[resource manifest](../offline_app/docs/RESOURCE_MANIFEST.md).

## Attribution and terms

- ETTh1 is from the [Electricity Transformer Dataset](https://github.com/zhouhaoyi/ETDataset).
- The processed COVID-19 series is derived from the
  [JHU CSSE COVID-19 Data Repository](https://github.com/CSSEGISandData/COVID-19),
  licensed by Johns Hopkins University under CC BY 4.0. Attribute it as
  "JHU CSSE COVID-19 Data" and cite Dong, Du and Gardner (2020),
  DOI `10.1016/S1473-3099(20)30120-1`.
- Exchange-Rate is the public benchmark distributed with the pinned MTGNN
  source and originates from Lai et al.'s multivariate time-series benchmark.

These datasets, checkpoints and learned weights are not relicensed by the
repository's MIT License. They remain subject to their original data, model and
upstream terms. They are included to make the submitted artifact auditable.
