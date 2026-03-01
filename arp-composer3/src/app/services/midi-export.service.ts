import { Injectable } from '@angular/core';
import { ArpGrid } from '../models/arp-grid.model';
import { ChordProgression } from '../models/chord.model';
import { ArpeggioConfig, STEPS_PER_MEASURE } from '../models/arpeggio-config.model';
import { CELL_VELOCITY, STACCATO_DURATION_RATIO, NORMAL_DURATION_RATIO } from '../models/arp-cell.model';
import { ChordService } from './chord.service';

// --- Minimal MIDI file writer helpers ---

function writeUint32BE(arr: number[], val: number): void {
  arr.push((val >> 24) & 0xff, (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff);
}

function writeUint16BE(arr: number[], val: number): void {
  arr.push((val >> 8) & 0xff, val & 0xff);
}

function writeVarLen(arr: number[], val: number): void {
  if (val < 0x80) { arr.push(val); return; }
  const buf: number[] = [];
  buf.push(val & 0x7f);
  val >>= 7;
  while (val > 0) { buf.push((val & 0x7f) | 0x80); val >>= 7; }
  buf.reverse().forEach(b => arr.push(b));
}

interface MidiEvent { tick: number; data: number[] }

function buildTrack(events: MidiEvent[]): number[] {
  // Sort by tick
  events.sort((a, b) => a.tick - b.tick);
  const bytes: number[] = [];
  let lastTick = 0;
  for (const evt of events) {
    writeVarLen(bytes, evt.tick - lastTick);
    lastTick = evt.tick;
    evt.data.forEach(b => bytes.push(b));
  }
  // End of track
  writeVarLen(bytes, 0);
  bytes.push(0xff, 0x2f, 0x00);
  return bytes;
}

@Injectable({ providedIn: 'root' })
export class MidiExportService {

  export(
    grid: ArpGrid,
    progression: ChordProgression,
    config: ArpeggioConfig,
    chordService: ChordService,
  ): void {
    if (!progression.valid || progression.chords.length === 0) return;

    const PPQN = 480;
    const stepsPerMeasure = STEPS_PER_MEASURE[config.noteLength];
    const microsecondsPerBeat = Math.round(60_000_000 / config.bpm);
    const ticksPerStep = (PPQN * 4) / stepsPerMeasure;
    // Note duration is independent of grid resolution
    const ticksPerNoteDuration = (PPQN * 4) / STEPS_PER_MEASURE[config.noteDuration];

    const events: MidiEvent[] = [];

    // Tempo meta event at tick 0
    events.push({
      tick: 0,
      data: [
        0xff, 0x51, 0x03,
        (microsecondsPerBeat >> 16) & 0xff,
        (microsecondsPerBeat >> 8) & 0xff,
        microsecondsPerBeat & 0xff,
      ],
    });

    // Program change: Xylophone (GM 13, 0-indexed = 12)
    events.push({ tick: 0, data: [0xC0 | ((config.midiChannel - 1) & 0x0f), 12] });

    const totalMeasures = progression.chords.length;

    for (let m = 0; m < totalMeasures; m++) {
      const chord = progression.chords[m];
      const measureStartTick = m * stepsPerMeasure * ticksPerStep;

      for (let step = 0; step < stepsPerMeasure; step++) {
        const stepTick = measureStartTick + step * ticksPerStep;

        for (let ri = 0; ri < grid.rows.length; ri++) {
          const row = grid.rows[ri];
          const cell = row.cells[step];
          if (!cell || cell.state === 'off') continue;

          const midiNote = chordService.getMidiNoteForRow(
            chord, row.degree, row.octaveOffset, config.baseOctave,
          );
          const velocity = CELL_VELOCITY[cell.state];
          const ratio = cell.state === 'staccato' ? STACCATO_DURATION_RATIO : NORMAL_DURATION_RATIO;
          const durationTicks = Math.round(ticksPerNoteDuration * ratio);

          const ch = (config.midiChannel - 1) & 0x0f;
          events.push({ tick: stepTick,                 data: [0x90 | ch, midiNote, velocity] });
          events.push({ tick: stepTick + durationTicks, data: [0x80 | ch, midiNote, 0] });
        }
      }
    }

    const trackBytes = buildTrack(events);

    // Build MIDI file
    const file: number[] = [];
    // Header chunk
    file.push(0x4d, 0x54, 0x68, 0x64); // MThd
    writeUint32BE(file, 6);
    writeUint16BE(file, 0);  // format 0
    writeUint16BE(file, 1);  // 1 track
    writeUint16BE(file, PPQN);
    // Track chunk
    file.push(0x4d, 0x54, 0x72, 0x6b); // MTrk
    writeUint32BE(file, trackBytes.length);
    trackBytes.forEach(b => file.push(b));

    const blob = new Blob([new Uint8Array(file)], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arpeggio.mid';
    a.click();
    URL.revokeObjectURL(url);
  }
}
