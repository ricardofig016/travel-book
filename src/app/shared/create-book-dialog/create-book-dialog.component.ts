import {
  Component,
  inject,
  signal,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/data/supabase.service';
import { UserLookupResult } from '../../services/data/supabase/models';
import { CreateBookResult } from './models';

@Component({
  selector: 'app-create-book-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-book-dialog.component.html',
  styleUrl: './create-book-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateBookDialogComponent {
  private supabase = inject(SupabaseService);

  readonly confirm = output<CreateBookResult>();
  readonly cancel = output<void>();

  readonly bookName = signal('');
  readonly memberEmail = signal('');
  readonly members = signal<UserLookupResult[]>([]);
  readonly lookupLoading = signal(false);
  readonly lookupError = signal<string | null>(null);

  async onLookupEmail(): Promise<void> {
    const email = this.memberEmail().trim();
    if (!email) return;

    // Check if already added
    if (this.members().some((m) => m.email === email)) {
      this.lookupError.set('This user is already added');
      return;
    }

    // Check if it's the current user
    const currentUser = this.supabase.getCurrentUser();
    if (currentUser?.email === email) {
      this.lookupError.set('You are automatically added as the creator');
      return;
    }

    this.lookupLoading.set(true);
    this.lookupError.set(null);

    try {
      const result = await this.supabase.lookupUserByEmail(email);
      if (!result) {
        this.lookupError.set('No user found with this email');
        return;
      }

      this.members.update((current) => [...current, result]);
      this.memberEmail.set('');
    } catch {
      this.lookupError.set('Failed to look up user');
    } finally {
      this.lookupLoading.set(false);
    }
  }

  onRemoveMember(userId: string): void {
    this.members.update((current) =>
      current.filter((m) => m.user_id !== userId),
    );
  }

  onConfirm(): void {
    const name = this.bookName().trim();
    if (!name) return;

    this.confirm.emit({
      name,
      memberUserIds: this.members().map((m) => m.user_id),
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
