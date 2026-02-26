import { Component, input } from '@angular/core';

@Component({
  selector: 'app-step-position-bar',
  standalone: true,
  template: `
    <div class="position-bar">
      <span class="bar-label">Position</span>
      <div class="pos-spacer"></div>
      <div class="steps">
        @for (step of steps(); track $index) {
          <div
            class="pos-cell"
            [class.active]="$index === currentStep()"
          ></div>
        }
      </div>
    </div>
  `,
  styleUrl: './step-position-bar.component.scss',
})
export class StepPositionBarComponent {
  steps = input.required<number[]>();
  currentStep = input<number>(-1);
}
