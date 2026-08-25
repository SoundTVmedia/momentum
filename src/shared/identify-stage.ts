/**
 * Stages of a clip-player tap-to-identify pass.
 *
 * Every stage is logged on the console and surfaced in the button label, so a
 * failure says which step failed instead of a bare "Song lookup failed".
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
  start: 'Preparing the clip…',
  download: 'Downloading the clip audio…',
  'shazamkit-fast': 'Listening for a song…',
  'shazamkit-scan': 'Scanning the whole clip…',
  acrcloud: 'Trying the backup music service…',
  worker: 'Trying the backup music service…',
  done: 'Finishing up…',
};

export function identifyStageLabel(stage: IdentifySongStage): string {
  return STAGE_LABELS[stage] ?? STAGE_LABELS.start;
}
