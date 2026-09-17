/**
 * Stages of a clip-player identify pass.
 *
 * Logged on the console only — the player UI shows a spinner + "Identifying".
 */
export type IdentifySongStage =
  | 'start'
  | 'download'
  | 'shazamkit-fast'
  | 'shazamkit-scan'
  | 'acrcloud'
  | 'worker'
  | 'done';

export type IdentifySongStageEvent = {
  stage: IdentifySongStage;
  /** Short machine-ish detail for the console line (path kind, byte count, code). */
  detail?: string | null;
};

export type IdentifyStageReporter = (event: IdentifySongStageEvent) => void;

const STAGE_LABELS: Record<IdentifySongStage, string> = {
  start: 'Identifying',
  download: 'Identifying',
  'shazamkit-fast': 'Identifying',
  'shazamkit-scan': 'Identifying',
  acrcloud: 'Identifying',
  worker: 'Identifying',
  done: 'Identifying',
};

export function identifyStageLabel(stage: IdentifySongStage): string {
  return STAGE_LABELS[stage] ?? STAGE_LABELS.start;
}
