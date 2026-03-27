import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-photo-album',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './photo-album.component.html',
  styleUrl: './photo-album.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAlbumComponent {
  private route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly countrySlug = computed(() => this.params().get('countrySlug'));
  readonly citySlug = computed(() => this.params().get('citySlug'));
  readonly idTail = computed(() => this.params().get('idTail'));

  readonly viewType = computed<'landing' | 'country' | 'city-marker'>(() => {
    if (this.idTail()) return 'city-marker';
    if (this.countrySlug()) return 'country';
    return 'landing';
  });
}
