import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  CitySearchResult,
  SupabaseService,
} from '../../services/data/supabase.service';

type AccountMode = 'signin' | 'signup' | 'authenticated';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  // Auth state from service
  readonly currentUser = this.supabase.currentUser;
  readonly isAuthenticated = this.supabase.isAuthenticated;

  // Component state
  readonly mode = signal<AccountMode>('signin');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Sign in form
  readonly signinEmail = signal('');
  readonly signinPassword = signal('');

  // Sign up form
  readonly signupName = signal('');
  readonly signupEmail = signal('');
  readonly signupPassword = signal('');
  readonly signupConfirmPassword = signal('');
  readonly citySearchTerm = signal('');
  readonly citySearchResults = signal<CitySearchResult[]>([]);
  readonly selectedCity = signal<CitySearchResult | null>(null);
  readonly showCityDropdown = signal(false);

  // Profile data
  readonly userName = computed(
    () => this.currentUser()?.user_metadata?.['name'] ?? 'Unknown',
  );
  readonly userEmail = computed(() => this.currentUser()?.email ?? '');
  readonly homeCity = signal<string>('Loading...');

  constructor() {
    // Set initial mode based on auth state
    effect(() => {
      if (this.isAuthenticated()) {
        this.mode.set('authenticated');
        this.loadHomeCity();
      } else {
        this.mode.set('signin');
      }
    });
  }

  navigatePrev(): void {
    this.router.navigate(['/']);
  }

  navigateNext(): void {
    this.router.navigate(['/index']);
  }

  switchToSignIn(): void {
    this.mode.set('signin');
    this.error.set(null);
  }

  switchToSignUp(): void {
    this.mode.set('signup');
    this.error.set(null);
  }

  async onSignIn(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.supabase.signIn(this.signinEmail(), this.signinPassword());
      // Auth state change will trigger mode switch
      this.signinEmail.set('');
      this.signinPassword.set('');
    } catch (err: any) {
      this.error.set(err?.message ?? 'Sign in failed');
    } finally {
      this.loading.set(false);
    }
  }

  async onSignUp(): Promise<void> {
    // Validation
    if (this.signupPassword() !== this.signupConfirmPassword()) {
      this.error.set('Passwords do not match');
      return;
    }

    if (!this.selectedCity()) {
      this.error.set('Please select a home city');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.supabase.signUp(
        this.signupName(),
        this.signupEmail(),
        this.signupPassword(),
        this.selectedCity()!.id,
      );
      // Auth state change will trigger mode switch
      this.clearSignUpForm();
    } catch (err: any) {
      this.error.set(err?.message ?? 'Sign up failed');
    } finally {
      this.loading.set(false);
    }
  }

  async onSignOut(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.supabase.signOut();
      // Auth state change will trigger mode switch
    } catch (err: any) {
      this.error.set(err?.message ?? 'Sign out failed');
    } finally {
      this.loading.set(false);
    }
  }

  async onCitySearchInput(): Promise<void> {
    const term = this.citySearchTerm();

    // Clear selected city if user edits after selection
    if (this.selectedCity()) {
      this.selectedCity.set(null);
    }

    if (term.length < 2) {
      this.citySearchResults.set([]);
      this.showCityDropdown.set(false);
      return;
    }

    try {
      const results = await this.supabase.searchCities(term);
      this.citySearchResults.set(results);
      this.showCityDropdown.set(results.length > 0);
    } catch (err) {
      console.error('City search error:', err);
      this.citySearchResults.set([]);
      this.showCityDropdown.set(false);
    }
  }

  selectCity(city: CitySearchResult): void {
    this.selectedCity.set(city);
    this.citySearchTerm.set(`${city.name}, ${city.country}`);
    this.showCityDropdown.set(false);
    this.citySearchResults.set([]);
  }

  private clearSignUpForm(): void {
    this.signupName.set('');
    this.signupEmail.set('');
    this.signupPassword.set('');
    this.signupConfirmPassword.set('');
    this.citySearchTerm.set('');
    this.selectedCity.set(null);
    this.citySearchResults.set([]);
  }

  private async loadHomeCity(): Promise<void> {
    try {
      const profile = await this.supabase.getUserProfile();

      if (profile?.home_city_id) {
        const { data } = await this.supabase
          .getClient()
          .from('cities')
          .select('name, countries(name)')
          .eq('id', profile.home_city_id)
          .single();

        if (data) {
          const countryName = (data as any).countries?.name || 'Unknown';
          this.homeCity.set(`${data.name}, ${countryName}`);
        } else {
          this.homeCity.set('Not set');
        }
      } else {
        this.homeCity.set('Not set');
      }
    } catch (err) {
      console.error('Error loading home city:', err);
      this.homeCity.set('Error loading');
    }
  }
}
