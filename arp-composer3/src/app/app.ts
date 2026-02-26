import { Component, OnInit, inject } from '@angular/core';
import { MidiService } from './services/midi.service';
import { ArpGridService } from './services/arp-grid.service';
import { ArpeggioPlaybackService } from './services/arpeggio-playback.service';
import { MidiExportService } from './services/midi-export.service';
import { ConfigService } from './services/config.service';
import { ChordService } from './services/chord.service';
import { ToneSynthService } from './services/tone-synth.service';
import { ChordProgression } from './models/chord.model';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { ConfigPanelComponent } from './components/config-panel/config-panel.component';
import { ArpGridComponent } from './components/arp-grid/arp-grid.component';
import { ChordInputComponent } from './components/chord-input/chord-input.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ToolbarComponent, ConfigPanelComponent, ArpGridComponent, ChordInputComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly _midiSvc      = inject(MidiService);
  private readonly _gridSvc      = inject(ArpGridService);
  private readonly _playbackSvc  = inject(ArpeggioPlaybackService);
  private readonly _exportSvc    = inject(MidiExportService);
  private readonly _configSvc    = inject(ConfigService);
  private readonly _chordSvc     = inject(ChordService);
  private readonly _toneSvc      = inject(ToneSynthService);

  readonly midiState = this._midiSvc.state;

  private _progression: ChordProgression = { raw: '', chords: [], valid: false, error: null };

  async ngOnInit(): Promise<void> {
    await this._midiSvc.init();
    this._toneSvc.init();
  }

  onProgressionChange(p: ChordProgression): void {
    this._progression = p;
    this._playbackSvc.setProgression(p);
  }

  play(): void {
    if (!this._progression.valid) return;
    this._playbackSvc.play();
  }

  stop(): void {
    this._playbackSvc.stop();
  }

  clearAll(): void {
    this._playbackSvc.stop();
    this._gridSvc.clearAll();
  }

  midiExport(): void {
    this._exportSvc.export(
      this._gridSvc.grid(),
      this._progression,
      this._configSvc.config(),
      this._chordSvc,
    );
  }

  exportArp(): void {
    const json = this._gridSvc.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arpeggio.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  loadArp(json: string): void {
    this._gridSvc.importJson(json);
  }
}
