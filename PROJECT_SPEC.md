# Travel Book

## Overview

Personal travel journal web app using a physical book metaphor. Navigation flow:
Cover -> Index -> Map -> Albums -> Statistics -> Back Cover.

## Stack + Services

- Angular (TypeScript), npm, GitHub Pages.
- Supabase for markers/cities/notes (keep-alive cron every 2-3 days).
- Cloudinary for photo storage.
- Local storage for cache/session state.

## Core UX

- **Book Cover**: click to open with a page flip to Index.
- **Book Index**: table of contents for Map, Albums, Statistics (disabled).
- **World Map**:
  - Minimal map: white land, blue sea, borders by hierarchy.
  - Hierarchy selector: Country -> State/District -> optional third level.
  - Modes: Marker mode (pins) and Area mode (fill visited regions).
  - Click region -> searchable city list (sorted by population) -> marker form.
  - Marker details view with "See Album" if photos exist.
- **Photo Albums**:
  - Scrapbook two-page spreads; taped/rotated photos; page flip navigation.
  - Back cover options: cover, index, map, restart album.
- **Bookmarks**: persistent tabs; dynamic positioning by section.

## Data Requirements

Marker object:

```
{
  location: { city, country, state?, lat, lng },
  status: { visited, favorite, want },
  content: { notes, dates, companions, activities, photoUrls[] },
  metadata: { createdAt, updatedAt }
}
```

Geographic data: hierarchy relationships, city populations, coordinates.

## Animations + Interaction

- Page flips required for section transitions and album navigation.
- Block new navigation until flip completes.
- Subtle marker pop-in; smooth modal and list transitions.

## Visual Essentials

- Pages: #F5F1E8, #E8DCC4; Sea: #4A90E2; Land: #FFFFFF.
- Markers: visited #8BC34A, favorite #FF5722, wishlist #FFC107.
- Typography: classic serif titles, readable sans body, handwritten notes.
- Scrapbook feel: tape, rotation, soft shadows.

## Deployment + Security

- GitHub Pages output: dist/travel-book/browser/, base href /travel-book/.
- Do not commit secrets; use Supabase RLS.
- Supabase keep-alive GitHub Action with minimal GET.

## Build Phases

1. Cover/Index/Basic map + hierarchy.
2. Marker management + area mode.
3. Cloudinary integration.
4. Album feature + scrapbook layout.
5. Bookmarks + navigation.
6. Responsive + performance polish.
7. Statistics (future).

## Reference Links

- page ideas: https://benomadpt.com/products/travel-book
- figma: https://www.figma.com/design/fbJetSJm9PbxAsOqDnpvG7/Travel-Book?node-id=54198-66&p=f&t=hX0FHvQySuNl1V2Y-0
- storyteller gameplay: https://www.youtube.com/watch?v=MNZFmLQBR4I
- css flipbook tutorial: https://www.youtube.com/watch?v=W6K26i9FwZU
