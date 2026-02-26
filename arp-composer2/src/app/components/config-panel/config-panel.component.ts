import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ConfigService } from '../../services/config.service';
import { MidiService } from '../../services/midi.service';

interface NoteOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-config-panel',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './config-panel.component.html',
  styleUrl: './config-panel.component.scss',
})
export class ConfigPanelComponent {
  private readonly _configService = inject(ConfigService);
  private readonly _midiService = inject(MidiService);

  readonly config = this._configService.config;
  readonly midiState = this._midiService.state;

  readonly beatsOptions = [2, 3, 4, 5, 6, 7, 8];

  readonly noteOptions: NoteOption[] = this._buildNoteOptions();

  get bpm(): number { return this.config().bpm; }
  set bpm(v: number) { this._configService.setConfig({ bpm: Number(v) }); }

  get beatsPerMeasure(): number { return this.config().beatsPerMeasure; }
  set beatsPerMeasure(v: number) { this._configService.setConfig({ beatsPerMeasure: Number(v) }); }

  get midiNote(): number { return this.config().midiNote; }
  set midiNote(v: number) { this._configService.setConfig({ midiNote: Number(v) }); }

  get midiChannel(): number { return this.config().midiChannel; }
  set midiChannel(v: number) { this._configService.setConfig({ midiChannel: Number(v) }); }

  get noteDurationRatio(): number { return this.config().noteDurationRatio; }
  set noteDurationRatio(v: number) { this._configService.setConfig({ noteDurationRatio: Number(v) }); }

  onOutputChange(id: string): void {
    this._midiService.selectOutput(id);
  }

  private _buildNoteOptions(): NoteOption[] {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const options: NoteOption[] = [];
    for (let octave = 2; octave <= 7; octave++) {
      for (let i = 0; i < 12; i++) {
        const midiNote = (octave + 1) * 12 + i;
        if (midiNote >= 36 && midiNote <= 103) {
          options.push({ label: `${names[i]}${octave} (${midiNote})`, value: midiNote });
        }
      }
    }
    return options;
  }

  noteLabel(midiNote: number): string {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    return `${names[midiNote % 12]}${octave}`;
  }
}
