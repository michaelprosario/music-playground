import { Component, inject } from '@angular/core';
import { PlaybackService } from '../../services/playback.service';
import { ConfigService } from '../../services/config.service';
import { PatternService } from '../../services/pattern.service';

@Component({
  selector: 'app-playback-controls',
  standalone: true,
  imports: [],
  templateUrl: './playback-controls.component.html',
  styleUrl: './playback-controls.component.scss',
})
export class PlaybackControlsComponent {
  private readonly _playbackService = inject(PlaybackService);
  private readonly _configService = inject(ConfigService);
  private readonly _patternService = inject(PatternService);

  readonly isPlaying = this._playbackService.isPlaying;
  readonly state = this._playbackService.state;
  readonly config = this._configService.config;
  readonly validation = this._patternService.validation;

  play(): void {
    this._playbackService.play();
  }

  stop(): void {
    this._playbackService.stop();
  }

  get canPlay(): boolean {
    return !this.isPlaying() && this.validation().valid;
  }
}
