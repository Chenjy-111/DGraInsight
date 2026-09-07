from __future__ import annotations

import json
from pathlib import Path

from dgraudit.evaluation import prepare_results, run_evaluation, validate_results, write_results


def execute(args):
    try:
        if args.command == "plugins":
            from dgraudit.evaluation_plugins import PLUGIN_INFO
            print(json.dumps(PLUGIN_INFO, indent=2))
        elif args.command == "validate-results":
            data = validate_results(json.loads(Path(args.results).read_text(encoding="utf-8-sig")))
            print(f"Result data valid: {data['model']}, {len(data['samples'])} samples, {len(data['records'])} removals; native intervention verification is separate.")
        elif args.command == "export-results":
            destination = Path(args.output)
            if destination.exists():
                raise ValueError("Output exists; choose a new path.")
            data = json.loads(Path(args.input).read_text(encoding="utf-8-sig"))
            write_results(prepare_results(data), destination)
            print(f"Evaluation Results written to {destination}")
        else:
            from dgraudit.evaluation_plugins import load_backend
            path = Path(args.config).resolve()
            config = json.loads(path.read_text(encoding="utf-8-sig"))
            if config.get("version") != "evaluation.config.v1":
                raise ValueError("Expected evaluation.config.v1; use configs/evaluation_*.json instead of legacy audit configs")
            if args.command != "preflight" and Path(args.output).exists() and not args.resume:
                raise ValueError("Output exists; choose another path or --resume")
            destination = Path(args.output).resolve() if args.output else None
            from dgraudit.evaluation_validation import validate_backend, render_report, CHECKS
            try:
                backend = load_backend(config, path.parent)
            except Exception as exc:
                report = {"version": "evaluation.validation.v1", "status": "FAIL", "graphStateVerification": {"status": "unavailable"}, "checks": [{"id": k, "label": v, "status": "FAIL" if i == 0 else "UNAVAILABLE", "detail": str(exc) if i == 0 else "Adapter was not loaded."} for i, (k, v) in enumerate(CHECKS)]}
                print(render_report(report))
                return 1
            report = validate_backend(backend, config["samples"][0], config.get("requests"))
            print(render_report(report))
            if args.command == "preflight" or report["status"] != "PASS":
                backend.close()
                if destination and args.command == "preflight":
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_text(json.dumps(report, indent=2), encoding="utf-8")
                return 0 if report["status"] == "PASS" else 1
            backend.metadata.setdefault("provenance", {})["preflight"] = report
            backend.metadata.setdefault("provenance", {})["evaluationConfig"] = config
            data = run_evaluation(backend, config["samples"], destination, requests=config.get("requests"), resume=args.resume)
            print(f"Complete: {len(data['records'])} removals. Import {args.output} in DGraInsight.")
        return 0
    except Exception as exc:
        print(f"Evaluation failed: {exc}")
        return 1
