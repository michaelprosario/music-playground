import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PatternService } from '../../services/pattern.service';
import { PlaybackService } from '../../services/playback.service';

@Component({
  selector: 'app-pattern-input',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './pattern-input.component.html',
  styleUrl: './pattern-input.component.scss',
})
export class PatternInputComponent {
  private readonly _patternService = inject(PatternService);
  private readonly _playbackService = inject(PlaybackService);

  readonly patternString = this._patternService.patternString;
  readonly validation = this._patternService.validation;
  readonly currentStep = this._playbackService.currentStep;
  readonly isPlaying = this._playbackService.isPlaying;

  readonly steps = computed(() => {
    const str = this.patternString();
    return [...str].map((char, i) => ({ char, isNote: char === '*', index: i }));
  });

  onPatternChange(value: string): void {
    this._patternService.setPattern(value);
  }

  isActiveStep(index: number): boolean {
    return this.isPlaying() && this.currentStep() === index;
  }
}
