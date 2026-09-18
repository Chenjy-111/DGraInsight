import argparse
from dgraudit.cli.evaluate import execute


def main():
    parser = argparse.ArgumentParser(description="DGraInsight Offline: native relation removal and forecast error evaluation")
    sub = parser.add_subparsers(dest="action", required=True)
    for name in ("validate", "run"):
        command = sub.add_parser(name)
        command.add_argument("config")
        command.add_argument("--output", default=None if name == "validate" else "outputs/evaluation/manifest.json")
        command.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    args.command = "preflight" if args.action == "validate" else "evaluate"
    return execute(args)


if __name__ == "__main__":
    raise SystemExit(main())
