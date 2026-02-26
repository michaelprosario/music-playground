import { Injectable, signal } from '@angular/core';

export interface MidiServiceState {
  supported: boolean;
  usingFallback: boolean;
  outputs: MIDIOutput[];
  selectedOutputId: string | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class MidiService {
  private _access: MIDIAccess | null = null;
  private _audioCtx: AudioContext | null = null;

  // Active oscillator nodes for fallback (keyed by note number)
  private _activeNodes = new Map<
    number,
    { osc: OscillatorNode; gain: GainNode }
  >();

  private readonly _state = signal<MidiServiceState>({
    supported: false,
    usingFallback: false,
    outputs: [],
    selectedOutputId: null,
    error: null,
  });

  readonly state = this._state.asReadonly();

  async init(): Promise<void> {
    if (typeof navigator === 'undefined') return;

    if ((navigator as Navigator & { requestMIDIAccess?: unknown }).requestMIDIAccess) {
      try {
        this._access = await (navigator as Navigator & { requestMIDIAccess: () => Promise<MIDIAccess> }).requestMIDIAccess();
        const outputs = Array.from(this._access.outputs.values());
        this._state.set({
          supported: true,
          usingFallback: false,
          outputs,
          selectedOutputId: outputs[0]?.id ?? null,
          error: null,
        });

        this._access.onstatechange = () => {
          const updated = Array.from(this._access!.outputs.values());
          this._state.update(s => ({ ...s, outputs: updated }));
        };
      } catch (err) {
        this._initFallback(`MIDI access denied: ${(err as Error).message}`);
      }
    } else {
      this._initFallback('Web MIDI API not supported in this browser. Using Web Audio fallback.');
    }
  }

  private _initFallback(error: string): void {
    this._audioCtx = new AudioContext();
    this._state.set({
      supported: false,
      usingFallback: true,
      outputs: [],
      selectedOutputId: null,
      error,
    });
  }

  selectOutput(id: string): void {
    this._state.update(s => ({ ...s, selectedOutputId: id }));
  }

  listOutputs(): MIDIOutput[] {
    return this._state().outputs;
  }

  noteOn(channel: number, note: number, velocity = 100, atTime?: number): void {
    if (this._state().usingFallback) {
      this._fallbackNoteOn(note, velocity, atTime);
      return;
    }
    const output = this._getSelectedOutput();
    if (!output) return;
    const status = 0x90 | ((channel - 1) & 0x0f);
    const data = [status, note & 0x7f, velocity & 0x7f];
    if (atTime !== undefined) {
      // Web MIDI doesn't support scheduling; best-effort immediate send
      // Players using AudioContext timing should call this close to the event
      output.send(data);
    } else {
      output.send(data);
    }
  }

  noteOff(channel: number, note: number, atTime?: number): void {
    if (this._state().usingFallback) {
      this._fallbackNoteOff(note, atTime);
      return;
    }
    const output = this._getSelectedOutput();
    if (!output) return;
    const status = 0x80 | ((channel - 1) & 0x0f);
    output.send([status, note & 0x7f, 0]);
  }

  allNotesOff(channel: number): void {
    if (this._state().usingFallback) {
      this._activeNodes.forEach(({ osc, gain }) => {
        gain.gain.cancelScheduledValues(0);
        gain.gain.setValueAtTime(0, 0);
        osc.stop(0);
      });
      this._activeNodes.clear();
      return;
    }
    const output = this._getSelectedOutput();
    if (!output) return;
    const status = 0xb0 | ((channel - 1) & 0x0f);
    output.send([status, 123, 0]); // All Notes Off CC
  }

  private _getSelectedOutput(): MIDIOutput | null {
    const { outputs, selectedOutputId } = this._state();
    if (!selectedOutputId) return outputs[0] ?? null;
    return outputs.find(o => o.id === selectedOutputId) ?? null;
  }

  // --- Web Audio fallback ---

  private _midiNoteToFreq(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  private _fallbackNoteOn(note: number, velocity: number, atTime?: number): void {
    if (!this._audioCtx) return;
    const ctx = this._audioCtx;

    // Stop any previous note on this pitch
    this._stopFallbackNote(note, ctx.currentTime);

    const freq = this._midiNoteToFreq(note);
    const startTime = atTime ?? ctx.currentTime;
    const gain = ctx.createGain();
    const amp = (velocity / 127) * 0.4;
    gain.gain.setValueAtTime(amp, startTime);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.connect(gain);
    osc.start(startTime);

    this._activeNodes.set(note, { osc, gain });
  }

  private _fallbackNoteOff(note: number, atTime?: number): void {
    if (!this._audioCtx) return;
    const ctx = this._audioCtx;
    this._stopFallbackNote(note, atTime ?? ctx.currentTime);
  }

  private _stopFallbackNote(note: number, stopTime: number): void {
    const node = this._activeNodes.get(note);
    if (!node) return;
    const { osc, gain } = node;
    gain.gain.cancelScheduledValues(stopTime);
    gain.gain.setValueAtTime(gain.gain.value, stopTime);
    gain.gain.linearRampToValueAtTime(0, stopTime + 0.02);
    osc.stop(stopTime + 0.03);
    this._activeNodes.delete(note);
  }

  getAudioContext(): AudioContext | null {
    return this._audioCtx;
  }

  resumeAudioContext(): void {
    if (this._audioCtx?.state === 'suspended') {
      this._audioCtx.resume();
    }
  }
}
