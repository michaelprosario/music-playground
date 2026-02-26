import { Component, inject, computed } from '@angular/core';
import { ArpGridService } from '../../services/arp-grid.service';
import { ArpeggioPlaybackService } from '../../services/arpeggio-playback.service';
import { ArpRowComponent } from '../arp-row/arp-row.component';
import { StepPositionBarComponent } from '../step-position-bar/step-position-bar.component';

@Component({
  selector: 'app-arp-grid',
  standalone: true,
  imports: [ArpRowComponent, StepPositionBarComponent],
  template: `
    <div class="arp-grid">
      <app-step-position-bar
        [steps]="stepIndices()"
        [currentStep]="playbackSvc.currentStep()"
      />
      @for (row of gridSvc.grid().rows; track $index) {
        <app-arp-row
          [row]="row"
          (cellClicked)="onCellClicked($index, $event)"
          (clearRow)="gridSvc.clearRow($index)"
          (setVelocity)="gridSvc.setRowVelocity($index, $event)"
          (randomize)="gridSvc.randomizeRow($index)"
        />
      }
    </div>
  `,
  styleUrl: './arp-grid.component.scss',
})
export class ArpGridComponent {
  protected readonly gridSvc = inject(ArpGridService);
  protected readonly playbackSvc = inject(ArpeggioPlaybackService);

  readonly stepIndices = computed(() =>
    Array.from({ length: this.gridSvc.grid().stepsPerMeasure }, (_, i) => i)
  );

  onCellClicked(rowIdx: number, stepIdx: number): void {
    this.gridSvc.cycleCell(rowIdx, stepIdx);
  }
}
