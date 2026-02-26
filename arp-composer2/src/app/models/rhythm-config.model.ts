export interface RhythmConfig {
  bpm: number;
  beatsPerMeasure: number;
  midiNote: number;
  midiChannel: number;
  noteDurationRatio: number; // 0.1 – 0.9 fraction of subdivision length
}

export const DEFAULT_RHYTHM_CONFIG: RhythmConfig = {
  bpm: 120,
  beatsPerMeasure: 4,
  midiNote: 60,
  midiChannel: 1,
  noteDurationRatio: 0.5,
};
