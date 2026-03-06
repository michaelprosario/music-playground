import { Component, output, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChordService } from '../../services/chord.service';
import { ChordProgression } from '../../models/chord.model';

@Component({
  selector: 'app-chord-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="chord-input">
      <label for="chord-prog">Chord Progression:</label>
      <textarea
        id="chord-prog"
        rows="2"
        [(ngModel)]="raw"
        (ngModelChange)="onInput($event)"
        placeholder="Em C D G"
      ></textarea>
      @if (!progression().valid && progression().error) {
        <p class="error">{{ progression().error }}</p>
      }
    </div>
  `,
  styleUrl: './chord-input.component.scss',
})
export class ChordInputComponent implements OnInit {
  private readonly chordSvc = inject(ChordService);

  progressionChange = output<ChordProgression>();

  raw = 'G D Em C';
  readonly progression = signal<ChordProgression>({ raw: '', chords: [], valid: false, error: null });

  ngOnInit(): void {
    this.onInput(this.raw);
  }

  onInput(value: string): void {
    const parsed = this.chordSvc.parse(value);
    this.progression.set(parsed);
    this.progressionChange.emit(parsed);
  }
}
