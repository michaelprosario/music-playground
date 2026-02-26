export type ChordQuality =
  | 'major' | 'minor' | 'maj7' | 'm7' | '7'
  | 'dim' | 'aug' | 'sus2' | 'sus4';

export interface Chord {
  symbol: string;
  rootName: string;
  quality: ChordQuality;
  midiNotes: number[];
}

export interface ChordProgression {
  raw: string;
  chords: Chord[];
  valid: boolean;
  error: string | null;
}
