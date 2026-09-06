import type { AuditSessionV2 } from './auditSessionV2';

export const MSGNET_SEMANTICS_VERSION = 'msgnet.latent-source-target.v1';
export const MSGNET_GRAPH_NOTICE = 'G0–G6 are internal graph positions after embedding and convolution, not original variables. Arrows show message flow. Forecast variables are selected separately. Edge removal also renormalizes the receiving connections; changes can propagate into later scale blocks.';

export function graphNodeLabels(session: AuditSessionV2): string[] {
  if (session.model.adapter_id === 'msgnet') {
    const semantics = session.model.graph_semantics as { version?: string; node_labels?: string[] } | undefined;
    if (semantics?.version !== MSGNET_SEMANTICS_VERSION || !semantics.node_labels) throw new Error('MSGNet graph semantics have not been verified.');
    return semantics.node_labels;
  }
  return session.dataset.variables as string[];
}
