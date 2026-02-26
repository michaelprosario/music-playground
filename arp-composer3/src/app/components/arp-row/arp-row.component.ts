import { Component, input, output } from '@angular/core';
import { ArpRow } from '../../models/arp-grid.model';
import { ArpCellComponent } from '../arp-cell/arp-cell.component';

@Component({
  selector: 'app-arp-row',
  standalone: true,
  imports: [ArpCellComponent],
  template: `
    <div class="arp-row">
      <span class="row-label">{{ row().label }}</span>
      <div class="row-controls">
        <button type="button" (click)="clearRow.emit()">Clear</button>
        <button type="button" (click)="setVelocity.emit('v1')">1</button>
        <button type="button" (click)="setVelocity.emit('v2')">2</button>
        <button type="button" (click)="randomize.emit()">Rnd</button>
      </div>
      <div class="cells">
        @for (cell of row().cells; track $index) {
          <app-arp-cell
            [state]="cell.state"
            (clicked)="cellClicked.emit($index)"
          />
        }
      </div>
    </div>
  `,
  styleUrl: './arp-row.component.scss',
})
export class ArpRowComponent {
  row = input.required<ArpRow>();
  cellClicked = output<number>();
  clearRow = output<void>();
  setVelocity = output<'v1' | 'v2'>();
  randomize = output<void>();
}
