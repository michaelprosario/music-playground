import { Component, input, output } from '@angular/core';
import { CellState } from '../../models/arp-cell.model';

@Component({
  selector: 'app-arp-cell',
  standalone: true,
  template: `
    <button
      class="arp-cell"
      [class]="'state-' + state()"
      (click)="clicked.emit()"
      [title]="state()"
      type="button"
    >{{ state() === 'staccato' ? 'S' : '' }}</button>
  `,
  styleUrl: './arp-cell.component.scss',
})
export class ArpCellComponent {
  state = input.required<CellState>();
  clicked = output<void>();
}
