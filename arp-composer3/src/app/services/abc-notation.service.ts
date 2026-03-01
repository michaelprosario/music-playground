import { Injectable } from '@angular/core';
import { ArpGrid } from '../models/arp-grid.model';
import { ChordProgression } from '../models/chord.model';
import { ArpeggioConfig, NoteLength, STEPS_PER_MEASURE } from '../models/arpeggio-config.model';
import { ChordService } from './chord.service';

/** Chromatic pitch class names (ABC accidental + uppercase letter). */
const PITCH_CLASS_NAMES: string[] = [
  'C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B',
];

/** Map noteLength to ABC L: denominator string. */
const NOTE_LENGTH_TO_ABC_L: Record<string, string> = {
  whole:      '1/4',  // use 1/4 as base unit so whole = 4 units
  half:       '1/4',
  quarter:    '1/4',
  eighth:     '1/16',
  sixteenth:  '1/16',
};

/** How many ABC base-units make up one step given the noteLength (grid resolution). */
const STEP_DURATION: Record<string, number> = {
  whole:      16, // 4/4 with L:1/4 → whole measure = 4 units; but step IS the whole measure
  half:       2,
  quarter:    1,
  eighth:     2,  // L:1/16 × 2 = 1/8
  sixteenth:  1,  // L:1/16 × 1 = 1/16
};

/**
 * Returns how many ABC L-units correspond to the requested note duration,
 * given the current grid resolution (noteLength) which defines the L base.
 *
 * Formula: stepUnits(noteLength) × stepsPerMeasure(noteLength) / stepsPerMeasure(noteDuration)
 * This scales the L-unit step size to match the desired note duration.
 */
function calcNoteDurUnits(noteLength: NoteLength, noteDuration: NoteLength): number {
  return STEP_DURATION[noteLength] * STEPS_PER_MEASURE[noteLength] / STEPS_PER_MEASURE[noteDuration];
}

/** Convert a numeric ABC duration (possibly fractional) to an ABC suffix string. */
function abcDurSuffix(units: number): string {
  if (units === 1) return '';
  if (units >= 2 && Number.isInteger(units)) return String(units);
  // Fractional: e.g. 0.5 → '/2'
  const denom = Math.round(1 / units);
  return `/${denom}`;
}

/**
 * Converts a MIDI note number to an ABC note name.
 *
 * Octave reference (ABC default, key C):
 *   MIDI 60 (C4) = 'c'  (lowercase, no modifier)
 *   MIDI 48 (C3) = 'C'  (uppercase, no modifier)
 *   MIDI 72 (C5) = "c'" (lowercase + one apostrophe per octave above C4)
 *   MIDI 36 (C2) = 'C,' (uppercase + one comma per octave below C3)
 */
function midiToAbcNote(midi: number): string {
  const pc = midi % 12;
  const midiOctIdx = Math.floor(midi / 12); // C4 (MIDI 60) → index 5

  const rawName = PITCH_CLASS_NAMES[pc]; // e.g. 'C', '^C', 'D' ...

  // Separate accidental from note letter
  let acc = '';
  let letter = rawName;
  if (rawName.startsWith('^') || rawName.startsWith('_')) {
    acc = rawName[0];
    letter = rawName.slice(1);
  }

  if (midiOctIdx >= 5) {
    // Lowercase octave (C4+): add apostrophes for each octave above 4
    return acc + letter.toLowerCase() + "'".repeat(midiOctIdx - 5);
  } else {
    // Uppercase octave (C3 and below): add commas for each octave below 3
    return acc + letter.toUpperCase() + ','.repeat(4 - midiOctIdx);
  }
}

@Injectable({ providedIn: 'root' })
export class AbcNotationService {

  /**
   * Generates an ABC notation string for the arpeggio played once over
   * every chord in the progression.
   */
  generateAbc(
    grid: ArpGrid,
    progression: ChordProgression,
    config: ArpeggioConfig,
    chordService: ChordService,
  ): string {
    const { bpm, noteLength, noteDuration, baseOctave } = config;
    const abcL = NOTE_LENGTH_TO_ABC_L[noteLength] ?? '1/16';
    const stepDur = STEP_DURATION[noteLength] ?? 1;
    // Note display duration (independent of grid resolution)
    const noteDurUnits = calcNoteDurUnits(noteLength, noteDuration);
    const noteDurSuffix = abcDurSuffix(noteDurUnits);

    const headerLines = [
      'X:1',
      'T:Arpeggio',
      'M:4/4',
      `L:${abcL}`,
      `Q:1/4=${bpm}`,
      'K:C',
      '%%MIDI program 13',  // xylophone
    ];

    const measureStrings: string[] = progression.chords.map(chord => {
      const stepNotes: string[] = [];

      for (let stepIdx = 0; stepIdx < grid.stepsPerMeasure; stepIdx++) {
        // Collect all active rows at this step
        const activeNotes: string[] = [];

        for (const row of grid.rows) {
          const cell = row.cells[stepIdx];
          if (!cell || cell.state === 'off') continue;

          const midi = chordService.getMidiNoteForRow(
            chord,
            row.degree,
            row.octaveOffset,
            baseOctave,
          );
          // Drop one octave for notation readability
          const abcNote = midiToAbcNote(midi - 12);

          if (cell.state === 'staccato') {
            activeNotes.push('!staccato!' + abcNote + noteDurSuffix);
          } else {
            activeNotes.push(abcNote + noteDurSuffix);
          }
        }

        if (activeNotes.length === 0) {
          // Rest
          stepNotes.push(`z${stepDur}`);
        } else if (activeNotes.length === 1) {
          stepNotes.push(activeNotes[0]);
        } else {
          // Chord cluster: wrap in [ ]
          // Decorations must be outside the chord bracket
          const decs = activeNotes.filter(n => n.startsWith('!')).map(n => n.match(/^(!.*?!)/)?.[1] ?? '');
          const uniqueDec = [...new Set(decs)].join('');
          const cleanNotes = activeNotes.map(n => n.replace(/^!.*?!/, ''));
          stepNotes.push(`${uniqueDec}[${cleanNotes.join('')}]`);
        }
      }

      return stepNotes.join('') + '|';
    });

    return [...headerLines, measureStrings.join('')].join('\n');
  }
}
