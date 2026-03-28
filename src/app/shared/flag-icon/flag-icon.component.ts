import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

@Component({
  selector: 'app-flag-icon',
  standalone: true,
  templateUrl: './flag-icon.component.html',
  styleUrl: './flag-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlagIconComponent {
  private static readonly FLAG_CDN_BASE_URL = 'https://flagcdn.com';

  readonly isoCode2 = input<string | null | undefined>(null);
  readonly countryName = input<string>('Country');
  readonly width = input<number>(24);
  readonly height = input<number>(18);

  readonly flagUrl = computed(() => {
    const isoCode2 = this.isoCode2();
    if (!isoCode2) return null;

    const normalizedIsoCode = isoCode2.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(normalizedIsoCode)) return null;

    return `${FlagIconComponent.FLAG_CDN_BASE_URL}/${this.width()}x${this.height()}/${normalizedIsoCode}.png`;
  });

  readonly altText = computed(() => `${this.countryName()} flag`);
}
