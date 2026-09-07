from __future__ import annotations

import argparse


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="python -m dgraudit",
        description="DGraInsight offline edge-removal evaluation and legacy audit tools.",
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
    validate = subparsers.add_parser("validate", help="Validate Audit Config v2 and its applicable V01-V11 checks.")
    validate.add_argument("--config", required=True)
    validate.add_argument("--output")
    validate.add_argument("--debug", action="store_true")
    validate_adapter = subparsers.add_parser(
        "validate-adapter", help="Run V01-V09 adapter conformance for Quick Inspection readiness."
    )
    validate_adapter.add_argument("--config", required=True)
    validate_adapter.add_argument("--output")
    validate_adapter.add_argument("--debug", action="store_true")
    audit = subparsers.add_parser("audit", help="Legacy: run the historical audit and generate Session v2.")
    audit.add_argument("--config", required=True)
    audit.add_argument("--output", default="dgrainsight_session_v2.json")
    audit.add_argument("--no-embedded-trajectories", action="store_true")
    validate_session = subparsers.add_parser("validate-session", help="Validate a Portable Audit Session v2.")
    validate_session.add_argument("session")
    validate_session.add_argument("--schema")
    edges = subparsers.add_parser("edges", help="Show native graph counts and retained edge candidates.")
    edges.add_argument("--config", required=True)
    edges.add_argument("--sample", type=int)
    edges.add_argument("--context", type=int)
    edges.add_argument("--layer", type=int)
    edges.add_argument("--limit", type=int, default=10)
    edges.add_argument("--json", action="store_true", dest="as_json")
    wizard = subparsers.add_parser("wizard", help="Legacy: choose an edge for the historical Session v2 workflow.")
    wizard.add_argument("--config", required=True)
    wizard.add_argument("--output", default="dgrainsight_session_v2.json")
    wizard.add_argument("--source-root")
    wizard.add_argument("--checkpoint")
    wizard.add_argument("--dataset")
    wizard.add_argument("--sample", type=int)
    wizard.add_argument("--context", type=int)
    wizard.add_argument("--layer", type=int)
    wizard.add_argument("--edge-rank", type=int)
    wizard.add_argument("--limit", type=int, default=10)
    wizard_scope = wizard.add_mutually_exclusive_group()
    wizard_scope.add_argument("--broader", action="store_true")
    wizard_scope.add_argument("--local-only", action="store_true")
    wizard.add_argument("--yes", action="store_true")
    wizard.add_argument("--mode", choices=("auto", "quick", "formal"), default="auto")
    args = parser.parse_args()
    if args.command in {"evaluate", "export-results", "validate-results", "plugins"}:
        from dgraudit.cli.evaluate import execute
        return execute(args)
    if args.command == "validate-session":
        from dgraudit.cli.validate_session_v2 import main as validate_session_main

        forwarded = [args.session]
        if args.schema:
            forwarded.extend(["--schema", args.schema])
        return validate_session_main(forwarded)
    if args.command == "validate":
        from dgraudit.cli.validate_audit import main as validate_main

        forwarded = ["--config", args.config]
        if args.output:
            forwarded.extend(["--output", args.output])
        if args.debug:
            forwarded.append("--debug")
        return validate_main(forwarded)
    if args.command == "validate-adapter":
        from dgraudit.cli.validate_adapter import main as validate_adapter_main

        forwarded = ["--config", args.config]
        if args.output:
            forwarded.extend(["--output", args.output])
        if args.debug:
            forwarded.append("--debug")
        return validate_adapter_main(forwarded)
    if args.command == "edges":
        from dgraudit.cli.inspect_edges import main as inspect_main

        forwarded = ["--config", args.config, "--limit", str(args.limit)]
        if args.sample is not None:
            forwarded.extend(["--sample", str(args.sample)])
        if args.context is not None:
            forwarded.extend(["--context", str(args.context)])
        if args.layer is not None:
            forwarded.extend(["--layer", str(args.layer)])
        if args.as_json:
            forwarded.append("--json")
        return inspect_main(forwarded)
    if args.command == "wizard":
        from dgraudit.cli.wizard import main as wizard_main

        forwarded = [
            "--config", args.config,
            "--output", args.output,
            "--limit", str(args.limit),
        ]
        for flag, value in (
            ("--source-root", args.source_root), ("--checkpoint", args.checkpoint),
            ("--dataset", args.dataset), ("--sample", args.sample),
            ("--context", args.context), ("--layer", args.layer),
            ("--edge-rank", args.edge_rank),
        ):
            if value is not None:
                forwarded.extend([flag, str(value)])
        if args.broader:
            forwarded.append("--broader")
        if args.local_only:
            forwarded.append("--local-only")
        if args.yes:
            forwarded.append("--yes")
        forwarded.extend(["--mode", args.mode])
        return wizard_main(forwarded)
    from dgraudit.cli.audit import main as audit_main

    forwarded = [
        "--config", args.config,
        "--output", args.output,
    ]
    if args.no_embedded_trajectories:
        forwarded.append("--no-embedded-trajectories")
    return audit_main(forwarded)


if __name__ == "__main__":
    raise SystemExit(main())
