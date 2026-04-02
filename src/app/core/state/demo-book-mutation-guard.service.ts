import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { SupabaseService } from '../../services/data/supabase.service';
import { BookStateService } from './book-state.service';

@Injectable({ providedIn: 'root' })
export class DemoBookMutationGuardService {
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService);
  private readonly bookState = inject(BookStateService);

  canMutateSelectedBook(): boolean {
    const selectedBook = this.bookState.selectedBook();
    if (!selectedBook?.is_public) return true;

    if (!this.supabase.isAuthenticated()) {
      window.alert(
        'You cannot modify the demo book. Please sign in or sign up to create your own book.',
      );
      void this.router.navigate(['/account']);
      return false;
    }

    window.alert(
      'You cannot modify the demo book. Create a new book to make changes.',
    );
    return false;
  }
}
