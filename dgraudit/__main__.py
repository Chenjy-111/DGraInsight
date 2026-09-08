from __future__ import annotations

import argparse


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="python -m dgraudit",
        description="DGraInsight offline edge-removal evaluation.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    evaluate = subparsers.add_parser("evaluate", help="Run edge-removal performance evaluation through a model plugin or existing functions.")
    evaluate.add_argument("--config", required=True)
    evaluate.add_argument("--output", default="evaluation_results.json")
    evaluate.add_argument("--resume", action="store_true")
    export_results = subparsers.add_parser("export-results", help="Package existing predictions or metrics as Evaluation Results.")
    export_results.add_argument("--input", required=True)
    export_results.add_argument("--output", required=True)
    results = subparsers.add_parser("validate-results", help="Validate result structure and recompute metrics when arrays are available.")
    results.add_argument("results")
    subparsers.add_parser("plugins", help="List maintained model evaluation plugins and compatibility boundaries.")
    preflight = subparsers.add_parser("preflight", help="Validate a current evaluation adapter before running.")
    preflight.add_argument("--config", required=True)
    preflight.add_argument("--output")
    preflight.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    from dgraudit.cli.evaluate import execute
    return execute(args)


if __name__ == "__main__":
    raise SystemExit(main())
