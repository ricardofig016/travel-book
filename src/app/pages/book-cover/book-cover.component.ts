import {
  Component,
  OnInit,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/data/supabase.service';

@Component({
  selector: 'app-book-cover',
  standalone: true,
  imports: [],
  templateUrl: './book-cover.component.html',
  styleUrl: './book-cover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookCoverComponent implements OnInit {
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  connectionStatus = signal<{
    ok: boolean;
    error: string | null;
    countriesCount: number;
  } | null>(null);

  async ngOnInit(): Promise<void> {
    // Check Supabase connection on component init
    const status = await this.supabase.checkConnection();
    this.connectionStatus.set(status);
  }

  navigatePrev(): void {
    this.router.navigate(['/statistics']);
  }

  navigateNext(): void {
    this.router.navigate(['/index']);
  }
}
