import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BookStateService } from '../../core/state/book-state.service';
import { DemoBookMutationGuardService } from '../../core/state/demo-book-mutation-guard.service';
import { AlbumDataService } from '../../services/album/album-data.service';
import { AlbumRouteService } from '../../services/album/album-route.service';
import { FlagIconComponent } from '../../shared/flag-icon/flag-icon.component';
import { MarkerFormComponent } from '../../shared/marker-form/marker-form.component';
import {
  MarkerFormState,
  MarkerVisitFormRow,
} from '../../shared/marker-form/marker-form.models';
import {
  createEmptyMarkerForm,
  createMarkerFormFromSnapshot,
  toMarkerMutationInput,
} from '../../shared/marker-form/marker-form.utils';
import {
  AlbumCityMarkerData,
  AlbumCountryCityItem,
  AlbumCountryIndexItem,
  AlbumCountryPageData,
  AlbumCountryDishItem,
  AlbumMarkerVisit,
  AlbumPhoto,
} from '../../services/album/models';

@Component({
  selector: 'app-photo-album',
  standalone: true,
  imports: [CommonModule, RouterLink, FlagIconComponent, MarkerFormComponent],
  templateUrl: './album.component.html',
  styleUrl: './album.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAlbumComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly bookState = inject(BookStateService);
  private readonly demoBookMutationGuard = inject(DemoBookMutationGuardService);
  private readonly albumData = inject(AlbumDataService);
  private readonly albumRoutes = inject(AlbumRouteService);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private requestId = 0;

  readonly selectedBook = this.bookState.selectedBook;
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly countryIndex = signal<AlbumCountryIndexItem[]>([]);
  readonly countryPage = signal<AlbumCountryPageData | null>(null);
  readonly cityMarkerPage = signal<AlbumCityMarkerData | null>(null);
  readonly markerActionError = signal<string | null>(null);
  readonly markerEditMode = signal(false);
  readonly markerPanelSubmitting = signal(false);
  readonly markerPanelDeleting = signal(false);
  readonly markerPanelForm = signal<MarkerFormState>(createEmptyMarkerForm());
  readonly isUploadingPhoto = signal(false);
  readonly deletingPhotoIds = signal<Set<string>>(new Set());
  readonly photoActionError = signal<string | null>(null);
  readonly countryDishActionError = signal<string | null>(null);
  readonly updatingDishIds = signal<Set<string>>(new Set());
  readonly isPhotoPanelOpen = signal(false);
  readonly photoFormMode = signal<'create' | 'edit'>('create');
  readonly editingPhoto = signal<AlbumPhoto | null>(null);
  readonly selectedUploadFile = signal<File | null>(null);
  readonly uploadCaption = signal('');
  readonly uploadDateTaken = signal('');

  readonly countrySlug = computed(() => this.params().get('countrySlug'));
  readonly citySlug = computed(() => this.params().get('citySlug'));
  readonly idTail = computed(() => this.params().get('idTail'));

  readonly viewType = computed<'landing' | 'country' | 'city-marker'>(() => {
    if (this.idTail()) return 'city-marker';
    if (this.countrySlug()) return 'country';
    return 'landing';
  });

  readonly hasSelectedBook = computed(() => Boolean(this.selectedBook()));

  constructor() {
    effect(() => {
      const bookId = this.selectedBook()?.id ?? null;
      const countrySlug = this.countrySlug();
      const citySlug = this.citySlug();
      const idTail = this.idTail();

      void this.loadDataForRoute(bookId, countrySlug, citySlug, idTail);
    });
  }

  private createMarkerFormFromPage(
    markerPage: AlbumCityMarkerData,
  ): MarkerFormState {
    return createMarkerFormFromSnapshot({
      visited: markerPage.status.visited,
      favorite: markerPage.status.favorite,
      want: markerPage.status.want,
      notes: markerPage.notes,
      companions: markerPage.companions,
      activities: markerPage.activities,
      visits: markerPage.visits.map((visit) => ({
        startDate: visit.startDate,
        endDate: visit.endDate,
      })),
    });
  }

  private async loadDataForRoute(
    bookId: string | null,
    countrySlug: string | null,
    citySlug: string | null,
    idTail: string | null,
  ): Promise<void> {
    const requestId = ++this.requestId;
    this.loadError.set(null);
    this.photoActionError.set(null);
    this.countryDishActionError.set(null);
    this.markerActionError.set(null);
    this.isLoading.set(true);
    this.countryPage.set(null);
    this.cityMarkerPage.set(null);
    this.updatingDishIds.set(new Set());
    this.markerEditMode.set(false);
    this.markerPanelForm.set(createEmptyMarkerForm());
    this.markerPanelSubmitting.set(false);
    this.markerPanelDeleting.set(false);

    if (!bookId) {
      this.countryIndex.set([]);
      this.isLoading.set(false);
      return;
    }

    try {
      const countryIndex = await this.albumData.getCountryIndex(bookId);
      if (requestId !== this.requestId) return;
      this.countryIndex.set(countryIndex);

      if (!countrySlug) {
        this.isLoading.set(false);
        return;
      }

      if (citySlug && idTail) {
        const cityMarkerPage = await this.albumData.getCityMarkerPage(
          bookId,
          countrySlug,
          citySlug,
          idTail,
        );

        if (requestId !== this.requestId) return;

        if (!cityMarkerPage) {
          this.loadError.set('Marker not found for this route.');
          this.isLoading.set(false);
          return;
        }

        this.cityMarkerPage.set(cityMarkerPage);
        this.isLoading.set(false);
        return;
      }

      const countryPage = await this.albumData.getCountryPage(
        bookId,
        countrySlug,
      );

      if (requestId !== this.requestId) return;

      if (!countryPage) {
        this.loadError.set("You've never visited this country!");
        this.isLoading.set(false);
        return;
      }

      this.countryPage.set(countryPage);
      this.isLoading.set(false);
    } catch (error) {
      if (requestId !== this.requestId) return;

      console.error('Failed to load album data', error);
      this.loadError.set('Failed to load album data.');
      this.countryIndex.set([]);
      this.countryPage.set(null);
      this.cityMarkerPage.set(null);
      this.isLoading.set(false);
    }
  }

  startMarkerEdit(): void {
    if (!this.demoBookMutationGuard.canMutateSelectedBook()) return;

    const markerPage = this.cityMarkerPage();
    if (!markerPage) return;

    this.markerPanelForm.set(this.createMarkerFormFromPage(markerPage));
    this.markerEditMode.set(true);
    this.markerActionError.set(null);
  }

  cancelMarkerEdit(): void {
    this.markerEditMode.set(false);
    this.markerActionError.set(null);
    const markerPage = this.cityMarkerPage();
    if (!markerPage) {
      this.markerPanelForm.set(createEmptyMarkerForm());
      return;
    }

    this.markerPanelForm.set(this.createMarkerFormFromPage(markerPage));
  }

  async saveMarkerPanelChanges(): Promise<void> {
    const markerPage = this.cityMarkerPage();
    const selectedBookId = this.selectedBook()?.id ?? null;
    const countrySlug = this.countrySlug();
    const citySlug = this.citySlug();
    const idTail = this.idTail();

    if (
      !markerPage ||
      !selectedBookId ||
      !countrySlug ||
      !citySlug ||
      !idTail ||
      this.markerPanelSubmitting()
    ) {
      this.markerActionError.set('Cannot save marker from this route.');
      return;
    }

    if (!this.demoBookMutationGuard.canMutateSelectedBook()) return;

    this.markerActionError.set(null);
    this.markerPanelSubmitting.set(true);

    try {
      const updatedMarker = await this.albumData.updateMarkerForBook(
        markerPage.markerId,
        selectedBookId,
        toMarkerMutationInput(this.markerPanelForm()),
      );

      if (!updatedMarker) {
        this.markerActionError.set('Failed to save marker.');
        return;
      }

      this.markerEditMode.set(false);
      await this.refreshCityMarkerPage(
        selectedBookId,
        countrySlug,
        citySlug,
        idTail,
      );
    } catch (error) {
      console.error('Failed to save marker', error);
      this.markerActionError.set('Failed to save marker.');
    } finally {
      this.markerPanelSubmitting.set(false);
    }
  }

  async deleteSelectedMarker(): Promise<void> {
    const markerPage = this.cityMarkerPage();
    const selectedBookId = this.selectedBook()?.id ?? null;
    const countrySlug = this.countrySlug();
    if (
      !markerPage ||
      !selectedBookId ||
      !countrySlug ||
      this.markerPanelDeleting()
    ) {
      this.markerActionError.set('Cannot delete marker from this route.');
      return;
    }

    if (!this.demoBookMutationGuard.canMutateSelectedBook()) return;

    const confirmed = window.confirm(
      `Delete marker for ${markerPage.city.name}? This cannot be undone.`,
    );
    if (!confirmed) return;

    this.markerActionError.set(null);
    this.markerPanelDeleting.set(true);

    try {
      const deleted = await this.albumData.deleteMarkerForBook(
        markerPage.markerId,
        selectedBookId,
      );

      if (!deleted) {
        this.markerActionError.set('Failed to delete marker.');
        return;
      }

      await this.router.navigateByUrl(
        this.albumRoutes.buildCountryAlbumPath(markerPage.country.name),
      );
    } catch (error) {
      console.error('Failed to delete marker', error);
      this.markerActionError.set('Failed to delete marker.');
    } finally {
      this.markerPanelDeleting.set(false);
    }
  }

  onMarkerFormFieldChange(
    field: Exclude<keyof MarkerFormState, 'visits'>,
    value: string | boolean,
  ): void {
    this.markerPanelForm.update((current) => ({
      ...current,
      [field]: value,
    }));
  }

  addMarkerVisitRow(): void {
    this.markerPanelForm.update((current) => ({
      ...current,
      visits: [...current.visits, { startDate: '', endDate: '' }],
    }));
  }

  removeMarkerVisitRow(index: number): void {
    this.markerPanelForm.update((current) => ({
      ...current,
      visits: current.visits.filter((_, idx) => idx !== index),
    }));
  }

  onMarkerVisitFieldChange(
    index: number,
    field: keyof MarkerVisitFormRow,
    value: string,
  ): void {
    this.markerPanelForm.update((current) => ({
      ...current,
      visits: current.visits.map((visit, idx) =>
        idx === index ? { ...visit, [field]: value } : visit,
      ),
    }));
  }

  onCountryDishStatusClick(
    event: MouseEvent,
    dish: AlbumCountryDishItem,
    currentValue: boolean,
  ): void {
    if (!this.demoBookMutationGuard.canMutateSelectedBook()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    void this.onCountryDishStatusChange(dish.dishId, !currentValue);
  }

  private async onCountryDishStatusChange(
    dishId: string,
    tried: boolean,
  ): Promise<void> {
    const selectedBookId = this.selectedBook()?.id ?? null;
    const countryPage = this.countryPage();

    if (!selectedBookId || !countryPage) {
      this.countryDishActionError.set('Cannot update dishes from this route.');
      return;
    }

    if (this.updatingDishIds().has(dishId)) return;

    this.countryDishActionError.set(null);
    this.updatingDishIds.update((current) => {
      const next = new Set(current);
      next.add(dishId);
      return next;
    });
    this.setCountryDishTriedState(dishId, tried);

    try {
      const updated = await this.albumData.setCountryDishTried(
        selectedBookId,
        dishId,
        tried,
      );

      if (!updated) {
        this.setCountryDishTriedState(dishId, !tried);
        this.countryDishActionError.set('Failed to update dish status.');
      }
    } catch (error) {
      console.error('Failed to update tried dish', error);
      this.setCountryDishTriedState(dishId, !tried);
      this.countryDishActionError.set('Failed to update dish status.');
    } finally {
      this.updatingDishIds.update((current) => {
        const next = new Set(current);
        next.delete(dishId);
        return next;
      });
    }
  }

  onPhotoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedUploadFile.set(file);
    this.photoActionError.set(null);
  }

  togglePhotoPanel(): void {
    if (this.isPhotoPanelOpen()) {
      this.closePhotoPanel();
      return;
    }

    if (!this.demoBookMutationGuard.canMutateSelectedBook()) return;

    this.openPhotoPanelForCreate();
  }

  startPhotoEdit(photo: AlbumPhoto): void {
    if (!this.demoBookMutationGuard.canMutateSelectedBook()) return;

    this.photoFormMode.set('edit');
    this.editingPhoto.set(photo);
    this.uploadCaption.set(photo.caption ?? '');
    this.uploadDateTaken.set(photo.dateTaken ?? '');
    this.selectedUploadFile.set(null);
    this.photoActionError.set(null);
    this.isPhotoPanelOpen.set(true);
  }

  closePhotoPanel(): void {
    this.isPhotoPanelOpen.set(false);
    this.photoFormMode.set('create');
    this.editingPhoto.set(null);
    this.selectedUploadFile.set(null);
    this.uploadCaption.set('');
    this.uploadDateTaken.set('');
    this.photoActionError.set(null);
  }

  async uploadPhotoForCurrentMarker(
    fileInput: HTMLInputElement,
  ): Promise<void> {
    const markerPage = this.cityMarkerPage();
    const selectedBookId = this.selectedBook()?.id ?? null;
    const countrySlug = this.countrySlug();
    const citySlug = this.citySlug();
    const idTail = this.idTail();
    const file = this.selectedUploadFile();
    const dateTaken = this.uploadDateTaken().trim();
    const caption = this.uploadCaption().trim();
    const visits = markerPage?.visits ?? [];
    const isEditing = this.photoFormMode() === 'edit';

    if (
      !markerPage ||
      !selectedBookId ||
      !countrySlug ||
      !citySlug ||
      !idTail
    ) {
      this.photoActionError.set('Select an image before uploading.');
      return;
    }

    if (!this.demoBookMutationGuard.canMutateSelectedBook()) return;

    if (dateTaken && !this.isDateWithinVisits(dateTaken, visits)) {
      this.photoActionError.set(
        'Date taken must fall within one of the marker visit ranges.',
      );
      return;
    }

    this.photoActionError.set(null);
    this.isUploadingPhoto.set(true);

    try {
      if (isEditing && this.editingPhoto()) {
        await this.albumData.updateMarkerPhoto(
          markerPage.markerId,
          this.editingPhoto()!,
          file,
          {
            caption: caption.length > 0 ? caption : null,
            dateTaken: dateTaken.length > 0 ? dateTaken : null,
          },
        );
      } else {
        if (!file) {
          this.photoActionError.set('Select an image before uploading.');
          return;
        }

        await this.albumData.uploadMarkerPhoto(markerPage.markerId, file, {
          caption: caption.length > 0 ? caption : null,
          dateTaken: dateTaken.length > 0 ? dateTaken : null,
        });
      }

      this.closePhotoPanel();
      fileInput.value = '';

      await this.refreshCityMarkerPage(
        selectedBookId,
        countrySlug,
        citySlug,
        idTail,
      );
    } catch (error) {
      console.error('Failed to upload photo', error);
      const message =
        error instanceof Error ? error.message : 'Failed to upload photo.';
      this.photoActionError.set(message);
    } finally {
      this.isUploadingPhoto.set(false);
    }
  }

  private openPhotoPanelForCreate(): void {
    this.photoFormMode.set('create');
    this.editingPhoto.set(null);
    this.selectedUploadFile.set(null);
    this.uploadCaption.set('');
    this.uploadDateTaken.set('');
    this.photoActionError.set(null);
    this.isPhotoPanelOpen.set(true);
  }

  private isDateWithinVisits(
    dateTaken: string,
    visits: AlbumMarkerVisit[],
  ): boolean {
    if (!dateTaken || visits.length === 0) return false;

    return visits.some(
      (visit) => dateTaken >= visit.startDate && dateTaken <= visit.endDate,
    );
  }

  async deletePhotoForCurrentMarker(photoId: string): Promise<void> {
    const markerPage = this.cityMarkerPage();
    const selectedBookId = this.selectedBook()?.id ?? null;
    const countrySlug = this.countrySlug();
    const citySlug = this.citySlug();
    const idTail = this.idTail();

    if (
      !markerPage ||
      !selectedBookId ||
      !countrySlug ||
      !citySlug ||
      !idTail
    ) {
      this.photoActionError.set('Cannot delete photo from this route.');
      return;
    }

    if (!this.demoBookMutationGuard.canMutateSelectedBook()) return;

    this.photoActionError.set(null);
    this.deletingPhotoIds.update((current) => {
      const next = new Set(current);
      next.add(photoId);
      return next;
    });

    try {
      await this.albumData.deleteMarkerPhoto(markerPage.markerId, photoId);
      await this.refreshCityMarkerPage(
        selectedBookId,
        countrySlug,
        citySlug,
        idTail,
      );
    } catch (error) {
      console.error('Failed to delete photo', error);
      this.photoActionError.set('Failed to delete photo.');
    } finally {
      this.deletingPhotoIds.update((current) => {
        const next = new Set(current);
        next.delete(photoId);
        return next;
      });
    }
  }

  isDeletingPhoto(photoId: string): boolean {
    return this.deletingPhotoIds().has(photoId);
  }

  private async refreshCityMarkerPage(
    bookId: string,
    countrySlug: string,
    citySlug: string,
    idTail: string,
  ): Promise<void> {
    const [countryIndex, cityMarkerPage] = await Promise.all([
      this.albumData.getCountryIndex(bookId),
      this.albumData.getCityMarkerPage(bookId, countrySlug, citySlug, idTail),
    ]);

    this.countryIndex.set(countryIndex);
    if (cityMarkerPage) this.cityMarkerPage.set(cityMarkerPage);
  }

  private setCountryDishTriedState(dishId: string, tried: boolean): void {
    const page = this.countryPage();
    if (!page) return;

    this.countryPage.set({
      ...page,
      dishes: page.dishes.map((dish) =>
        dish.dishId === dishId ? { ...dish, isTried: tried } : dish,
      ),
    });
  }

  getCityMarkerLink(
    countrySlug: string,
    citySlug: string,
    idTail: string,
  ): string {
    return this.albumRoutes.buildCityMarkerPathFromSlugs(
      countrySlug,
      citySlug,
      idTail,
    );
  }

  formatPopulation(value: number | null): string {
    if (!value || value <= 0) return 'N/A';
    return value.toLocaleString();
  }

  formatArea(value: number | null): string {
    if (!value || value <= 0) return 'N/A';
    return `${Math.round(value).toLocaleString()} km²`;
  }

  trackCountryById(_index: number, item: AlbumCountryIndexItem): string {
    return item.countryId;
  }

  trackCityMarkerById(_index: number, item: AlbumCountryCityItem): string {
    return item.markerId;
  }

  trackDishById(_index: number, item: AlbumCountryDishItem): string {
    return item.dishId;
  }

  isDishUpdating(dishId: string): boolean {
    return this.updatingDishIds().has(dishId);
  }

  trackVisitById(_index: number, item: AlbumMarkerVisit): string {
    return item.id;
  }

  trackPhotoById(_index: number, item: AlbumPhoto): string {
    return item.id;
  }
}
