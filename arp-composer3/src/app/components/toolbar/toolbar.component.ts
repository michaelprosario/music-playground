import { Component, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';
import { NoteLength } from '../../models/arpeggio-config.model';

const NOTE_DURATION_OPTIONS: { label: string; value: NoteLength }[] = [
  { label: 'Whole Note',      value: 'whole' },
  { label: 'Quarter Note',    value: 'quarter' },
  { label: 'Eighth Note',     value: 'eighth' },
  { label: 'Sixteenth Note',  value: 'sixteenth' },
];

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="toolbar">
      <button type="button" class="btn btn-play"   (click)="play.emit()">▶ Play</button>
      <button type="button" class="btn btn-stop"   (click)="stop.emit()">■ Stop</button>
      <button type="button" class="btn btn-clear"  (click)="clearAll.emit()">Clear</button>
      <button type="button" class="btn btn-export" (click)="midiExport.emit()">Midi Export</button>
      <button type="button" class="btn btn-export" (click)="exportArp.emit()">Export Arp</button>
      <label class="btn btn-load">
        Load Arp
        <input type="file" accept=".json" (change)="onFileChange($event)" hidden />
      </label>
      <button type="button" class="btn btn-notation" (click)="showNotation.emit()">🎼 Show Notation</button>
      <div class="toolbar-control">
        <label class="control-label" for="noteDurationSelect">Note Length:</label>
        <select
          id="noteDurationSelect"
          class="toolbar-select"
          [ngModel]="configSvc.config().noteDuration"
          (ngModelChange)="configSvc.setConfig({ noteDuration: $event })"
        >
          @for (opt of noteDurationOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      </div>
    </div>
  `,
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent {
  protected readonly configSvc = inject(ConfigService);
  readonly noteDurationOptions = NOTE_DURATION_OPTIONS;
  play = output<void>();
  stop = output<void>();
  clearAll = output<void>();
  midiExport = output<void>();
  exportArp = output<void>();
  loadArp = output<string>();
  showNotation = output<void>();

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.loadArp.emit(reader.result);
      }
    };
    reader.readAsText(file);
    input.value = ''; // reset so same file can be loaded again
  }
}
