export type NoteLength = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export interface ArpeggioConfig {
  bpm: number;
  noteLength: NoteLength;
  midiChannel: number;
  baseOctave: number;
  /** 0-based General MIDI program number (0 = Acoustic Grand Piano, 13 = Xylophone, …) */
  gmProgram: number;
}

export const DEFAULT_ARPEGGIO_CONFIG: ArpeggioConfig = {
  bpm: 80,
  noteLength: 'sixteenth',
  midiChannel: 1,
  baseOctave: 4,
  gmProgram: 13, // Xylophone
};

export const STEPS_PER_MEASURE: Record<NoteLength, number> = {
  whole: 1,
  half: 2,
  quarter: 4,
  eighth: 8,
  sixteenth: 16,
};
