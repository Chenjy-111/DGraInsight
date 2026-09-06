import type { AuditSessionV2 } from '@/data/auditSessionV2';

export function ReplayValidationNotice({ session }: { session: AuditSessionV2 }) {
  const replay = session.validation?.independent_replay as { status?: string } | undefined;
  if (replay?.status !== 'FAIL') return null;
  return <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[12px] leading-relaxed text-amber-950"><b>Historical run · numerical reproduction unresolved.</b> The corrected deletion matches direct intervention inside the original model. Current CPU predictions differ slightly from the archived CUDA run, and some small MAE/MSE changes reverse direction. The values below describe the archived run; their improvement/degradation labels are not confirmed across these runtimes. Graph nodes G0–G6 are internal positions, not named input variables.</div>;
}
