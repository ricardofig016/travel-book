import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarkerFormState, MarkerVisitFormRow } from './marker-form.models';

@Component({
  selector: 'app-marker-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marker-form.component.html',
  styleUrl: './marker-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkerFormComponent {
  readonly form = input.required<MarkerFormState>();

  readonly fieldChange = output<{
    field: Exclude<keyof MarkerFormState, 'visits'>;
    value: string | boolean;
  }>();

  readonly visitFieldChange = output<{
    index: number;
    field: keyof MarkerVisitFormRow;
    value: string;
  }>();

  readonly addVisit = output<void>();
  readonly removeVisit = output<number>();
}
