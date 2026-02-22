# Travel Book

## Overview

Personal travel journal web app using a physical book metaphor. Navigation flow:
Cover -> Index -> Map -> Albums -> Statistics -> Back Cover.

## Stack + Services

- Angular (TypeScript), npm, GitHub Pages.
- Supabase for markers/cities/notes (keep-alive cron every 2 days).
- Cloudinary for photo storage.
- Local storage for cache/session state.

## Core UX

- **Book Cover**: click to open with a page flip to Index.
- **Book Index**: table of contents for Map, Albums, Statistics.
- **World Map**:
  - Minimal map: white land, blue sea, country borders.
  - Hierarchy: Country level only (MVP).
  - Countries automatically filled based on markers (user's home country colored distinctly from visited countries).
  - Click country -> searchable city list (sorted by population) -> marker form.
  - Marker details view with "See Album" if photos exist.
- **Photo Albums**:
  - Scrapbook two-page spreads; taped/rotated photos; page flip navigation.
  - Back cover options: cover, index, map, restart album.
- **Bookmarks**: persistent tabs; dynamic positioning by section.

## Data Requirements

Marker object:

```
{
  location: { city, country, lat, lng },
  status: { visited, favorite, want },
  content: { notes, dates, companions, activities, photoUrls[] },
  metadata: { createdAt, updatedAt }
}
```

Geographic data: country boundaries, city populations, coordinates (MVP - no state/district levels).

## Animations + Interaction

- Page flips required for section transitions and album navigation.
- Block new navigation until flip completes.
- Subtle marker pop-in; smooth modal and list transitions.

## Deployment + Security

- GitHub Pages output: dist/travel-book/browser/, base href /travel-book/.
- Do not commit secrets; use Supabase RLS.
- Supabase keep-alive GitHub Action with minimal GET.

## Build Phases

1. Cover/Index/Basic map + country hierarchy (MVP - no sub-levels).
2. Marker management + dynamic country fill.
3. Cloudinary integration.
4. Album feature + scrapbook layout.
5. Bookmarks + navigation.
6. Responsive + performance polish.
7. Statistics.

## Reference Links

### Design

- page ideas: https://benomadpt.com/products/travel-book
- figma: https://www.figma.com/design/fbJetSJm9PbxAsOqDnpvG7/Travel-Book?node-id=54198-66&p=f&t=hX0FHvQySuNl1V2Y-0
- storyteller gameplay: https://www.youtube.com/watch?v=MNZFmLQBR4I
- css flipbook tutorial: https://www.youtube.com/watch?v=W6K26i9FwZU

### Data

- city data: https://simplemaps.com/data/world-cities
- country boundaries:
- calling code (idd>root+idd>suffixes), capital, area, population, timezones, continents, name (nativeName), currencies, languages, coatOfArms(svg): https://restcountries.com/v3.1/name/{name}?fields
