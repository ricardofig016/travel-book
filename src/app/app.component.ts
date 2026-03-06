import {
  Component,
  OnInit,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './services/data/supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  title = 'travel-book';
  private supabase = inject(SupabaseService);

  connectionStatus = signal<{
    ok: boolean;
    error: string | null;
    countriesCount: number;
  } | null>(null);

  async ngOnInit(): Promise<void> {
    // Check Supabase connection on app init
    const status = await this.supabase.checkConnection();
    this.connectionStatus.set(status);
  }
}
