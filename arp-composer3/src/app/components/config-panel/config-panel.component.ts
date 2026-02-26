import { Component, inject, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';
import { ArpGridService } from '../../services/arp-grid.service';
import { NoteLength, STEPS_PER_MEASURE } from '../../models/arpeggio-config.model';

const NOTE_LENGTH_OPTIONS: { label: string; value: NoteLength }[] = [
  { label: 'Whole',      value: 'whole' },
  { label: 'Half',       value: 'half' },
  { label: 'Quarter',    value: 'quarter' },
  { label: 'Eighth',     value: 'eighth' },
  { label: 'Sixteenth',  value: 'sixteenth' },
];

@Component({
  selector: 'app-config-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="config-panel">
      <div class="config-row">
        <label>Note length:</label>
        <select [ngModel]="configSvc.config().noteLength" (ngModelChange)="onNoteLengthChange($event)">
          @for (opt of noteLengthOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      </div>
      <div class="config-row">
        <label>Tempo (BPM):</label>
        <input
          type="number"
          [ngModel]="configSvc.config().bpm"
          (ngModelChange)="configSvc.setConfig({ bpm: +$event })"
          min="20" max="300"
        />
      </div>
    </div>
  `,
  styleUrl: './config-panel.component.scss',
})
export class ConfigPanelComponent {
  protected readonly configSvc = inject(ConfigService);
  private readonly gridSvc = inject(ArpGridService);

  readonly noteLengthOptions = NOTE_LENGTH_OPTIONS;

  onNoteLengthChange(noteLength: NoteLength): void {
    this.configSvc.setConfig({ noteLength });
    this.gridSvc.resizeSteps(STEPS_PER_MEASURE[noteLength]);
  }
}
