import { Injectable } from '@angular/core';
import {
  Chord,
  ChordProgression,
  ChordQuality,
} from '../models/chord.model';
import { ChordDegree } from '../models/arp-grid.model';

/**
 * Maps each chord quality to the semitone offset for each grid degree.
 *
 * Degree meanings:
 *  root  = tonic (0 semitones)
 *  2nd   = major 2nd (2 semitones above root) — whole step
 *  third = characteristic 3rd of the quality (major/minor/suspended)
 *  fifth = characteristic 5th of the quality (perfect/dim/aug)
 */
const DEGREE_SEMITONES: Record<ChordQuality, Record<ChordDegree, number>> = {
  major: { root: 0, '2nd': 2, third: 4, fifth: 7 },
  minor: { root: 0, '2nd': 2, third: 3, fifth: 7 },
  maj7:  { root: 0, '2nd': 2, third: 4, fifth: 7 },
  m7:    { root: 0, '2nd': 2, third: 3, fifth: 7 },
  '7':   { root: 0, '2nd': 2, third: 4, fifth: 7 },
  dim:   { root: 0, '2nd': 2, third: 3, fifth: 6 },
  aug:   { root: 0, '2nd': 2, third: 4, fifth: 8 },
  sus2:  { root: 0, '2nd': 2, third: 2, fifth: 7 },  // suspended 2nd
  sus4:  { root: 0, '2nd': 2, third: 5, fifth: 7 },  // suspended 4th
};

const ROOT_NAMES: string[] = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
];

const ROOT_SEMITONES: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
  E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8,
  Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  maj7:  [0, 4, 7, 11],
  m7:    [0, 3, 7, 10],
  '7':   [0, 4, 7, 10],
  dim:   [0, 3, 6],
  aug:   [0, 4, 8],
  sus2:  [0, 2, 7],
  sus4:  [0, 5, 7],
};

@Injectable({ providedIn: 'root' })
export class ChordService {

  parse(input: string): ChordProgression {
    const tokens = input.trim().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) {
      return { raw: input, chords: [], valid: false, error: 'No chords entered.' };
    }

    const chords: Chord[] = [];
    for (const token of tokens) {
      const chord = this._parseSymbol(token);
      if (!chord) {
        return {
          raw: input,
          chords: [],
          valid: false,
          error: `Unknown chord symbol: "${token}"`,
        };
      }
      chords.push(chord);
    }

    return { raw: input, chords, valid: true, error: null };
  }

  getMidiNoteForRow(
    chord: Chord,
    degree: ChordDegree,
    octaveOffset: number,
    baseOctave: number,
  ): number {
    const interval = DEGREE_SEMITONES[chord.quality][degree];
    const midiNote =
      12 * (baseOctave + octaveOffset + 1) +
      this._rootSemitone(chord.rootName) +
      interval;
    return Math.max(0, Math.min(127, midiNote));
  }

  private _parseSymbol(token: string): Chord | null {
    // Try to match root name (longest first to handle sharps/flats)
    let rootName: string | null = null;
    let suffix = '';

    for (const name of ROOT_NAMES.sort((a, b) => b.length - a.length)) {
      if (token.startsWith(name)) {
        rootName = name;
        suffix = token.slice(name.length);
        break;
      }
    }
    if (!rootName) return null;

    const quality = this._parseQuality(suffix);
    if (!quality) return null;

    const intervals = this._intervals(quality);
    const rootSt = this._rootSemitone(rootName);
    // Build midiNotes at octave 4
    const midiNotes = intervals.map(i => 12 * 5 + rootSt + i);

    return { symbol: token, rootName, quality, midiNotes };
  }

  private _parseQuality(suffix: string): ChordQuality | null {
    // Order matters — try longer suffixes first
    const map: [string, ChordQuality][] = [
      ['maj7', 'maj7'],
      ['m7',   'm7'],
      ['dim',  'dim'],
      ['aug',  'aug'],
      ['sus2', 'sus2'],
      ['sus4', 'sus4'],
      ['7',    '7'],
      ['m',    'minor'],
      ['',     'major'],
    ];
    for (const [key, q] of map) {
      if (suffix === key) return q;
    }
    return null;
  }

  private _rootSemitone(name: string): number {
    return ROOT_SEMITONES[name] ?? 0;
  }

  private _intervals(q: ChordQuality): number[] {
    return QUALITY_INTERVALS[q];
  }
}
