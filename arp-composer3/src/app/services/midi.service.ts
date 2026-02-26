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
    { osc: OscillatorNode; gain: GainNode; stopTime: number }
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

        // Send GM program 13 (Xylophone) on channel 1
        this.programChange(1, 13);
      } catch (err) {
        this._initFallback(`MIDI access denied: ${(err as Error).message}`);
      }
    } else {
      this._initFallback('Web MIDI API not supported. Using Web Audio fallback (xylophone approximation).');
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

  programChange(channel: number, program: number): void {
    const output = this._getSelectedOutput();
    if (!output) return;
    output.send([0xC0 | ((channel - 1) & 0x0f), program & 0x7f]);
  }

  noteOn(channel: number, note: number, velocity = 100, atTime?: number): void {
    if (this._state().usingFallback) {
      this._fallbackNoteOn(note, velocity, atTime);
      return;
    }
    const output = this._getSelectedOutput();
    if (!output) return;
    const status = 0x90 | ((channel - 1) & 0x0f);
    output.send([status, note & 0x7f, velocity & 0x7f]);
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
      const now = this._audioCtx?.currentTime ?? 0;
      this._activeNodes.forEach(({ osc, gain }) => {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0, now);
          osc.stop(now + 0.01);
        } catch { /* ignore if already stopped */ }
      });
      this._activeNodes.clear();
      return;
    }
    const output = this._getSelectedOutput();
    if (!output) return;
    const status = 0xb0 | ((channel - 1) & 0x0f);
    output.send([status, 123, 0]);
  }

  private _getSelectedOutput(): MIDIOutput | null {
    const { outputs, selectedOutputId } = this._state();
    if (!selectedOutputId) return outputs[0] ?? null;
    return outputs.find(o => o.id === selectedOutputId) ?? null;
  }

  // --- Web Audio fallback (triangle oscillator with percussive envelope = xylophone approximation) ---

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
    const amp = (velocity / 127) * 0.5;

    // Gain node with percussive envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(amp, startTime + 0.001);  // 1ms attack
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35); // 350ms decay
    gain.connect(ctx.destination);

    // Triangle oscillator for xylophone-like timbre
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.connect(gain);
    osc.start(startTime);
    osc.stop(startTime + 0.4);

    this._activeNodes.set(note, { osc, gain, stopTime: startTime + 0.4 });
  }

  private _fallbackNoteOff(note: number, atTime?: number): void {
    if (!this._audioCtx) return;
    const ctx = this._audioCtx;
    const stopTime = atTime ?? ctx.currentTime;
    this._stopFallbackNote(note, stopTime);
  }

  private _stopFallbackNote(note: number, stopTime: number): void {
    const node = this._activeNodes.get(note);
    if (!node) return;
    const { osc, gain } = node;
    try {
      gain.gain.cancelScheduledValues(stopTime);
      gain.gain.setValueAtTime(gain.gain.value, stopTime);
      gain.gain.linearRampToValueAtTime(0, stopTime + 0.02);
      osc.stop(stopTime + 0.03);
    } catch { /* ignore */ }
    this._activeNodes.delete(note);
  }

  getAudioContext(): AudioContext | null {
    return this._audioCtx;
  }

  resumeAudioContext(): Promise<void> {
    if (this._audioCtx?.state === 'suspended') {
      return this._audioCtx.resume();
    }
    return Promise.resolve();
  }
}
