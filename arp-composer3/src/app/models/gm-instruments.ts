export interface GmInstrument {
  program: number; // 0-based GM program number
  name: string;
}

/** A curated subset of General MIDI instruments (program numbers are 0-based). */
export const GM_INSTRUMENTS: GmInstrument[] = [
  // Keyboards / Tuned Percussion
  { program: 0,  name: 'Acoustic Grand Piano' },
  { program: 4,  name: 'Electric Piano 1' },
  { program: 7,  name: 'Clavinet' },
  { program: 8,  name: 'Celesta' },
  { program: 9,  name: 'Glockenspiel' },
  { program: 10, name: 'Music Box' },
  { program: 11, name: 'Vibraphone' },
  { program: 12, name: 'Marimba' },
  { program: 13, name: 'Xylophone' },
  { program: 14, name: 'Tubular Bells' },
  // Organ
  { program: 16, name: 'Drawbar Organ' },
  { program: 19, name: 'Church Organ' },
  // Guitar
  { program: 24, name: 'Nylon Guitar' },
  { program: 25, name: 'Steel Guitar' },
  { program: 28, name: 'Electric Guitar (clean)' },
  { program: 30, name: 'Overdriven Guitar' },
  // Bass
  { program: 32, name: 'Acoustic Bass' },
  { program: 33, name: 'Electric Bass (finger)' },
  { program: 35, name: 'Fretless Bass' },
  // Strings & Ensemble
  { program: 40, name: 'Violin' },
  { program: 42, name: 'Cello' },
  { program: 46, name: 'Harp' },
  { program: 48, name: 'String Ensemble 1' },
  { program: 52, name: 'Choir Aahs' },
  // Brass
  { program: 56, name: 'Trumpet' },
  { program: 57, name: 'Trombone' },
  { program: 61, name: 'Brass Section' },
  // Woodwinds
  { program: 66, name: 'Tenor Sax' },
  { program: 73, name: 'Flute' },
  // Synth Leads
  { program: 80, name: 'Lead 1 (square)' },
  { program: 81, name: 'Lead 2 (sawtooth)' },
  // Synth Pads
  { program: 88, name: 'Pad 1 (new age)' },
  { program: 90, name: 'Pad 3 (polysynth)' },
  // World
  { program: 105, name: 'Banjo' },
  { program: 107, name: 'Koto' },
  // Sound Effects / Percussive
  { program: 112, name: 'Tinkle Bell' },
  { program: 115, name: 'Steel Drums' },
];
