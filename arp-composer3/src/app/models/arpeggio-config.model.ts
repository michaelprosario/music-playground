export type NoteLength = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export interface ArpeggioConfig {
  bpm: number;
  noteLength: NoteLength;
  midiChannel: number;
  baseOctave: number;
}

export const DEFAULT_ARPEGGIO_CONFIG: ArpeggioConfig = {
  bpm: 80,
  noteLength: 'sixteenth',
  midiChannel: 1,
  baseOctave: 4,
};

export const STEPS_PER_MEASURE: Record<NoteLength, number> = {
  whole: 1,
  half: 2,
  quarter: 4,
  eighth: 8,
  sixteenth: 16,
};
