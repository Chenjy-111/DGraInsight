import { create } from 'zustand';
import { parseCurrentAuditSession, type AuditSessionV2 } from '@/data/auditSessionV2';
import type { WorkflowModel } from './useWorkflowStore';
import { validateEvaluation, type EvaluationResults } from '@/data/evaluation';

type ImportedResult = AuditSessionV2 | EvaluationResults;
let importRevision = 0;

type ImportState = 'idle' | 'reading' | 'validating' | 'ready' | 'invalid';

interface AuditSessionState {
  source: 'built_in' | 'imported';
  sessionV2: AuditSessionV2 | null;
  evaluation: EvaluationResults | null;
  generation: number;
  fileName: string | null;
  previousModel: WorkflowModel | null;
  importState: ImportState;
  errors: string[];
  importFile: (file: File, previousModel: WorkflowModel) => Promise<ImportedResult | null>;
  importText: (text: string, fileName: string, previousModel: WorkflowModel) => ImportedResult | null;
  clearError: () => void;
  closeSession: () => void;
}

function validateImportedText(text: string) {
  try {
    const data = JSON.parse(text);
    if (data.version === 'evaluation.v1') {
      const result = validateEvaluation(data);
      return result.ok ? { value: result.value as ImportedResult, errors: [] as string[] } : { value: null, errors: result.errors };
    }
  } catch { return { value: null, errors: ['Invalid JSON'] }; }
  const result = parseCurrentAuditSession(text);
  return result.ok
    ? { value: result.value as ImportedResult, errors: [] as string[] }
    : { value: null, errors: result.errors };
}

export const useAuditSessionStore = create<AuditSessionState>((set, get) => ({
  source: 'built_in',
  sessionV2: null,
  evaluation: null,
  generation: 0,
  fileName: null,
  previousModel: null,
  importState: 'idle',
  errors: [],
  importFile: async (file, previousModel) => {
    const revision = ++importRevision;
    set({ importState: 'reading', errors: [] });
    let text: string;
    try {
      text = await file.text();
    } catch (error) {
      if (revision !== importRevision) return null;
      set({
        importState: 'invalid',
        errors: ['The selected file could not be read: ' + (error instanceof Error ? error.message : String(error))],
      });
      return null;
    }
    if (revision !== importRevision) return null;
    set({ importState: 'validating' });
    return get().importText(text, file.name, previousModel);
  },
  importText: (text, fileName, previousModel) => {
    ++importRevision;
    const result = validateImportedText(text);
    if (!result.value) {
      set({ importState: 'invalid', errors: result.errors });
      return null;
    }
    set({
      source: 'imported',
      generation: get().generation + 1,
      sessionV2: typeof result.value.model === 'string' ? null : result.value as AuditSessionV2,
      evaluation: typeof result.value.model === 'string' ? result.value as EvaluationResults : null,
      fileName,
      previousModel: get().source === 'imported' ? get().previousModel : previousModel,
      importState: 'ready',
      errors: [],
    });
    return result.value;
  },
  clearError: () => set({ errors: [], importState: get().source === 'imported' ? 'ready' : 'idle' }),
  closeSession: () => { ++importRevision; set({
    source: 'built_in',
    sessionV2: null,
    evaluation: null,
    fileName: null,
    previousModel: null,
    importState: 'idle',
    errors: [],
  }); },
}));
