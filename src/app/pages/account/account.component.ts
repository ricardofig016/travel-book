import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  private router = inject(Router);

  navigatePrev(): void {
    this.router.navigate(['/']);
  }

  navigateNext(): void {
    this.router.navigate(['/index']);
  }
}
