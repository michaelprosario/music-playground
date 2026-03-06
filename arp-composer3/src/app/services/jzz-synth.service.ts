import { Injectable, signal } from '@angular/core';
import JZZ from 'jzz';
import JzzSynthTiny from 'jzz-synth-tiny';

// Register the jzz-synth-tiny plugin with the JZZ engine at module load time.
JzzSynthTiny(JZZ);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPort = any;

@Injectable({ providedIn: 'root' })
export class JzzSynthService {
  private _port: AnyPort | null = null;
  private readonly _ready = signal(false);
  readonly isReady = this._ready.asReadonly();

  async init(gmProgram = 13): Promise<void> {
    try {
      // JZZ.synth.Tiny is added by the jzz-synth-tiny plugin — access via index
      // to satisfy noPropertyAccessFromIndexSignature compiler option.
      const jzzAny = JZZ as unknown as Record<string, Record<string, () => Promise<AnyPort>>>;
      const tinyFn = jzzAny['synth']?.['Tiny'];
      if (!tinyFn) {
        console.error('JZZ.synth.Tiny not available — ensure jzz-synth-tiny is installed.');
        return;
      }
      this._port = await tinyFn();
      await this._port.program(0, gmProgram);
      this._ready.set(true);
    } catch (err) {
      console.error('JZZ Tiny Synth init failed', err);
    }
  }

  /** Send a GM program change on the given 1-based channel. */
  setProgram(channel: number, gmProgram: number): void {
    if (!this._port) return;
    this._port.program(channel - 1, gmProgram);
  }

  /**
   * Send note-on, wait durationMs, then send note-off — all via JZZ chaining.
   * @param channel  1-based MIDI channel
   * @param midiNote MIDI note number (0–127)
   * @param velocity Note velocity (0–127)
   * @param durationMs Duration in milliseconds
   */
  note(channel: number, midiNote: number, velocity: number, durationMs: number): void {
    if (!this._port) return;
    // JZZ port methods use 0-based channels.
    this._port.note(channel - 1, midiNote, velocity, durationMs);
  }

  /** Send note-on only. */
  noteOn(channel: number, midiNote: number, velocity: number): void {
    if (!this._port) return;
    this._port.noteOn(channel - 1, midiNote, velocity);
  }

  /** Send note-off only. */
  noteOff(channel: number, midiNote: number): void {
    if (!this._port) return;
    this._port.noteOff(channel - 1, midiNote);
  }

  /** Send MIDI CC 123 (all notes off) on the given 1-based channel. */
  allNotesOff(channel: number): void {
    if (!this._port) return;
    this._port.allNotesOff(channel - 1);
  }
}
