import { Injectable, computed, inject, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

import { environment } from '../../core/config/environment';
import { SupabaseAuthService } from './supabase/auth.service';
import { SupabaseAlbumService } from './supabase/album.service';
import { SupabaseBooksService } from './supabase/books.service';
import { SupabaseCountriesService } from './supabase/countries.service';
import { SupabaseStatsService } from './supabase/stats.service';
import type {
  AlbumBookTriedDishRow,
  AlbumMarkerCountryRow,
  AlbumPhotoMutationInput,
  AlbumPhotoUpdateInput,
  AlbumPhotoRow,
  Book,
  BookCountryMarkerSummary,
  BookVisitedLandAreaStats,
  CitySearchResult,
  CountryCapitalCity,
  CountryCity,
  CountryIsoLookup,
  CountryMarkerDetail,
  MarkerFullDetail,
  MarkerMutationInput,
  CountryMarkerStatusPatch,
  CountryMetadata,
  HomeCityDisplay,
  SupabaseConnectionStatus,
  UserLookupResult,
  UserProfile,
} from './supabase/models';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly authService = inject(SupabaseAuthService);
  private readonly albumService = inject(SupabaseAlbumService);
  private readonly booksService = inject(SupabaseBooksService);
  private readonly countriesService = inject(SupabaseCountriesService);
  private readonly statsService = inject(SupabaseStatsService);

  private readonly client: SupabaseClient = createClient(
    environment.supabase.url,
    environment.supabase.publishableKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    },
  );

  // Auth state signals
  private readonly currentUserSignal = signal<User | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  constructor() {
    this.initAuthListener();
  }

  private async initAuthListener(): Promise<void> {
    // Get initial session
    const {
      data: { user },
    } = await this.client.auth.getUser();
    this.currentUserSignal.set(user);

    // Listen for auth state changes
    this.client.auth.onAuthStateChange((_event, session) => {
      this.currentUserSignal.set(session?.user ?? null);
    });
  }

  getCurrentUser(): User | null {
    return this.currentUserSignal();
  }

  async signIn(email: string, password: string): Promise<User> {
    return this.authService.signIn(this.client, email, password);
  }

  async signUp(
    name: string,
    email: string,
    password: string,
    homeCityId: string,
  ): Promise<User> {
    return this.authService.signUp(
      this.client,
      name,
      email,
      password,
      homeCityId,
    );
  }

  async signOut(): Promise<void> {
    return this.authService.signOut(this.client);
  }

  async searchCities(term: string): Promise<CitySearchResult[]> {
    return this.authService.searchCities(this.client, term);
  }

  async checkConnection(): Promise<SupabaseConnectionStatus> {
    return this.authService.checkConnection(this.client);
  }

  async getUserProfile(): Promise<UserProfile | null> {
    return this.authService.getUserProfile(this.client);
  }

  async setHideDemoBook(hide: boolean): Promise<boolean> {
    return this.authService.setHideDemoBook(this.client, hide);
  }

  async getUserBooks(): Promise<Book[]> {
    return this.booksService.getUserBooks(this.client);
  }

  async lookupUserByEmail(email: string): Promise<UserLookupResult | null> {
    return this.booksService.lookupUserByEmail(this.client, email);
  }

  async createBook(name: string, memberUserIds: string[] = []): Promise<Book> {
    return this.booksService.createBook(this.client, name, memberUserIds);
  }

  async getVisitedCountryIso2s(bookId: string): Promise<string[]> {
    return this.countriesService.getVisitedCountryIso2s(this.client, bookId);
  }

  async getCountryIsoLookup(): Promise<CountryIsoLookup> {
    return this.countriesService.getCountryIsoLookup(this.client);
  }

  async getCountryIso2ByCityId(cityId: string): Promise<string | null> {
    return this.countriesService.getCountryIso2ByCityId(this.client, cityId);
  }

  async getHomeCityDisplayByCityId(
    cityId: string,
  ): Promise<HomeCityDisplay | null> {
    return this.countriesService.getHomeCityDisplayByCityId(
      this.client,
      cityId,
    );
  }

  async getAlbumMarkerCountryRows(
    bookId: string,
    includeMarkerDetails = false,
  ): Promise<AlbumMarkerCountryRow[]> {
    return this.albumService.getMarkerCountryRows(
      this.client,
      bookId,
      includeMarkerDetails,
    );
  }

  async getAlbumBookTriedDishes(
    bookId: string,
    countryId: string,
  ): Promise<AlbumBookTriedDishRow[]> {
    return this.albumService.getBookTriedDishesForCountry(
      this.client,
      bookId,
      countryId,
    );
  }

  async createAlbumMarkerPhoto(
    input: AlbumPhotoMutationInput,
  ): Promise<AlbumPhotoRow | null> {
    return this.albumService.createMarkerPhoto(this.client, input);
  }

  async updateAlbumMarkerPhoto(
    input: AlbumPhotoUpdateInput,
  ): Promise<AlbumPhotoRow | null> {
    return this.albumService.updateMarkerPhoto(this.client, input);
  }

  async deleteAlbumMarkerPhoto(
    markerId: string,
    photoId: string,
  ): Promise<boolean> {
    return this.albumService.deleteMarkerPhoto(this.client, markerId, photoId);
  }

  async getBookVisitedLandAreaStats(
    bookId: string,
  ): Promise<BookVisitedLandAreaStats> {
    return this.statsService.getBookVisitedLandAreaStats(this.client, bookId);
  }

  async getCountryMetadataByIso2(
    iso2: string,
  ): Promise<CountryMetadata | null> {
    return this.countriesService.getCountryMetadataByIso2(this.client, iso2);
  }

  async getCountryCapitalByIso2(
    iso2: string,
  ): Promise<CountryCapitalCity | null> {
    return this.countriesService.getCountryCapitalByIso2(this.client, iso2);
  }

  async getCountryCitiesByIso2(iso2: string): Promise<CountryCity[]> {
    return this.countriesService.getCountryCitiesByIso2(this.client, iso2);
  }

  async getCountryMarkersForBook(
    bookId: string,
    iso2: string,
  ): Promise<CountryMarkerDetail[]> {
    return this.countriesService.getCountryMarkersForBook(
      this.client,
      bookId,
      iso2,
    );
  }

  async getBookMarkersForBook(bookId: string): Promise<CountryMarkerDetail[]> {
    return this.countriesService.getBookMarkersForBook(this.client, bookId);
  }

  async updateMarkerStatuses(
    markerId: string,
    patch: CountryMarkerStatusPatch,
  ): Promise<boolean> {
    return this.countriesService.updateMarkerStatuses(
      this.client,
      markerId,
      patch,
    );
  }

  async getMarkerDetailForBook(
    markerId: string,
    bookId: string,
  ): Promise<MarkerFullDetail | null> {
    return this.countriesService.getMarkerDetailForBook(
      this.client,
      markerId,
      bookId,
    );
  }

  async createMarkerForBookCity(
    bookId: string,
    cityId: string,
    input: MarkerMutationInput,
  ): Promise<MarkerFullDetail | null> {
    return this.countriesService.createMarkerForBookCity(
      this.client,
      bookId,
      cityId,
      input,
    );
  }

  async updateMarkerForBook(
    markerId: string,
    bookId: string,
    input: MarkerMutationInput,
  ): Promise<MarkerFullDetail | null> {
    return this.countriesService.updateMarkerForBook(
      this.client,
      markerId,
      bookId,
      input,
    );
  }

  async deleteMarkerForBook(
    markerId: string,
    bookId: string,
  ): Promise<boolean> {
    return this.countriesService.deleteMarkerForBook(
      this.client,
      markerId,
      bookId,
    );
  }

  async getTotalLandArea(): Promise<number> {
    return this.statsService.getTotalLandArea(this.client);
  }

  async getBookMarkerCount(bookId: string): Promise<number> {
    return this.statsService.getBookMarkerCount(this.client, bookId);
  }

  async getBookCountryMarkerSummary(
    bookId: string,
    iso2: string,
  ): Promise<BookCountryMarkerSummary> {
    return this.statsService.getBookCountryMarkerSummary(
      this.client,
      bookId,
      iso2,
    );
  }
}
