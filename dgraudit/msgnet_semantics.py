"""MSGNet graph coordinates, independent of forecast-variable coordinates.

Native nconv: out[v] = sum_w A[v,w] * x[w]. Public graph tensors are
transposed to [source, target]. Frozen legacy IDs remain opaque artifact keys.
"""
from __future__ import annotations

VERSION = "msgnet.latent-source-target.v1"
NOTICE = ("G0, G1, ... are internal graph positions after embedding and convolution, "
          "not original input/output variables. Arrows show message flow. "
          "Removing a connection also renormalizes its native receiving row. "
          "A single-scale intervention may propagate into later scale blocks.")


def graph_semantics(count: int) -> dict:
    return {"version": VERSION, "node_kind": "latent_graph_position",
            "node_labels": [f"G{i}" for i in range(count)],
            "tensor_axes": ["source_node", "target_node"],
            "native_tensor_axes": ["target_node", "source_node"],
            "native_entry_for_edge": "A[target, source]", "notice": NOTICE}


def native_edge_indices(source: int, target: int) -> tuple[int, int]:
    return int(target), int(source)


def correct_legacy_graph(graph: dict) -> None:
    """Explicit, idempotent coordinate migration. Never alters forecasts."""
    if graph["model"].get("graph_semantics", {}).get("version") == VERSION:
        return
    count = graph["samples"][0]["contexts"][0]["node_count"]
    for sample in graph["samples"]:
        for context in sample["contexts"]:
            for tensor in context["graphs"].values():
                tensor["values"] = [list(row) for row in zip(*tensor["values"])]
                tensor["axis_order"] = ["source_node", "target_node"]
                # A byte hash of the original tensor cannot describe its transpose.
                if "sha256" in tensor:
                    tensor["native_sha256"] = tensor.pop("sha256")
    for relation in graph["relations"]:
        correct_legacy_member(relation)
    graph["model"]["graph_semantics"] = graph_semantics(count)
    graph.setdefault("provenance", {})["graph_semantics_correction"] = {
        "version": VERSION, "operation": "transpose native graphs and reverse legacy edge coordinates",
        "predictions_modified": False, "legacy_ids": "opaque native-coordinate artifact keys; use source/target fields for message direction",
    }


def correct_legacy_member(member: dict) -> None:
    row, col = member["source"], member["target"]
    member.update(source=col, target=row, source_name=f"G{col}", target_name=f"G{row}")


def correct_legacy_controls(cases: list[dict]) -> None:
    for case in cases:
        controls = case["controls"]
        controls["identities"] = ["->".join(identity.split("->")[::-1]) for identity in controls["identities"]]
        case.setdefault("provenance", {})["graph_semantics_version"] = VERSION


def semantics_errors(session: dict) -> list[str]:
    if session.get("model", {}).get("adapter_id") != "msgnet":
        return []
    model = session["model"]
    semantics = model.get("graph_semantics", {})
    if semantics.get("version") != VERSION:
        return ["MSGNet graph semantics are unverified: regenerate the session with the corrected MSGNet adapter; legacy variable labels/directions must not be displayed."]
    count = len(semantics.get("node_labels", []))
    if semantics != graph_semantics(count) or count == 0:
        return ["MSGNet graph semantics metadata is invalid"]
    errors = []
    for member in session.get("candidate_relations", []) + session.get("relations", []):
        for role in ("source", "target"):
            index = member.get(role)
            if not isinstance(index, int) or not 0 <= index < count or member.get(role + "_name") != f"G{index}":
                errors.append("MSGNet graph node labels/indices must identify internal G nodes")
    for sample in session.get("samples", []):
        for context in sample.get("contexts", []):
            if context.get("node_count") != count or any(t.get("axis_order") != ["source_node", "target_node"] for t in context.get("graphs", {}).values()):
                errors.append("MSGNet graph tensors must use canonical source/target axes")
    return errors
