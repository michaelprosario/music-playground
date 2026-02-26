import {
  Component,
  Input,
  OnDestroy,
  AfterViewInit,
  output,
} from '@angular/core';
import * as abcjs from 'abcjs';

@Component({
  selector: 'app-notation-modal',
  standalone: true,
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-box" role="dialog" aria-modal="true" aria-label="Music Notation">
        <div class="modal-header">
          <h2 class="modal-title">Music Notation Preview</h2>
          <button type="button" class="btn-close" (click)="close.emit()" aria-label="Close">✕</button>
        </div>

        <div class="modal-body">
          <div id="notation-target" class="notation-area"></div>
        </div>

        <div class="modal-footer">
          @if (audioSupported) {
            <div id="synth-controls" class="synth-controls"></div>
          } @else {
            <p class="audio-unsupported">
              ⚠ MIDI playback is not supported in this browser.
            </p>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './notation-modal.component.scss',
})
export class NotationModalComponent implements AfterViewInit, OnDestroy {
  @Input() abcString = '';

  close = output<void>();

  audioSupported = false;
  private synthController: abcjs.SynthObjectController | null = null;

  ngAfterViewInit(): void {
    // 1. Render the notation SVG
    const visualObj = abcjs.renderAbc('notation-target', this.abcString, {
      responsive: 'resize',
      add_classes: true,
      foregroundColor: '#000000',
      staffwidth: 900,
      wrap: {
        minSpacing: 1.5,
        maxSpacing: 2.8,
        preferredMeasuresPerLine: 4,
      } as unknown as abcjs.AbcVisualParams['wrap'],
    });

    // 2. Set up MIDI playback if supported
    this.audioSupported = abcjs.synth.supportsAudio();
    if (this.audioSupported && visualObj && visualObj.length > 0) {
      this.synthController = new abcjs.synth.SynthController();
      this.synthController.load('#synth-controls', null, {
        displayLoop: false,
        displayPlay: true,
        displayProgress: true,
      });
      this.synthController
        .setTune(visualObj[0], false, { soundFontUrl: 'https://paulrosen.github.io/midi-js-soundfonts/abcjs/' })
        .catch((err: unknown) => console.warn('abcjs synth init error:', err));
    }
  }

  ngOnDestroy(): void {
    if (this.synthController) {
      try { this.synthController.pause(); } catch { /* ignore */ }
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }
}
