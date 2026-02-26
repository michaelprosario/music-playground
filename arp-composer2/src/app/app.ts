import { Component, OnInit, inject } from '@angular/core';
import { MidiService } from './services/midi.service';
import { PatternInputComponent } from './components/pattern-input/pattern-input.component';
import { ConfigPanelComponent } from './components/config-panel/config-panel.component';
import { PlaybackControlsComponent } from './components/playback-controls/playback-controls.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [PatternInputComponent, ConfigPanelComponent, PlaybackControlsComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly _midiService = inject(MidiService);

  readonly midiState = this._midiService.state;

  async ngOnInit(): Promise<void> {
    await this._midiService.init();
  }
}
