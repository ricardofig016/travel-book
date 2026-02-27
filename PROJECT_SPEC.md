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
  - Minimal map: manually rendered country shapes from GeoJSON.
  - Hierarchy: Country level only (MVP).
  - Countries automatically filled based on markers (user's home country colored distinctly from visited countries).
  - Click country -> country entry page with:
    - Searchable city list -> marker form
    - Popular dishes checklist
    - Marker list
  - Marker details view with "See Album" if photos exist.
- **Photo Albums**:
  - Scrapbook two-page spreads; taped/rotated photos; page flip navigation.
  - Back cover options: cover, index, map, restart album.
- **Bookmarks**: persistent tabs; dynamic positioning by section.

## Data Requirements

**Database Schema** (see `supabase/schema.sql`):

- **Countries**: name, ISO codes, GeoJSON boundaries
- **Cities** (~48k from SimpleMaps): name (Unicode + ASCII), country, admin region, population, coordinates
- **User Profiles**: home_city_id for home country coloring
- **Dishes** (TasteAtlas data): name, category, location, rating, image, country
- **User Tried Dishes**: junction table tracking which dishes user has tried
- **Markers**: user_id, city_id, status (visited/favorite/want), notes, companions, activities
- **Marker Visits**: start_date, end_date pairs for each visit to a marker
- **Photos**: marker_id, Cloudinary URL + public_id, date_taken, caption, uploaded_at

**Key Relationships**:

- Markers → Cities → Countries (normalized location data)
- Photos → Markers (one-to-many)
- Marker Visits → Markers (one-to-many for multiple visits)
- User Tried Dishes ← Users + Dishes (many-to-many)

## Animations + Interaction

- Page flips required for section transitions and album navigation.
- Block new navigation until flip completes.
- Subtle marker pop-in; smooth modal and list transitions.

## Deployment + Security

- GitHub Pages output: dist/travel-book/browser/, base href /travel-book/.
- Do not commit secrets; use Supabase RLS.
- Supabase keep-alive GitHub Action with minimal GET.

## TBA

**Shareability**: Can a user share a "Read-only" link to their book with friends/family? If I can’t show off my "Travel Book," the motivation to spend hours "scrapbooking" drops significantly.

**Collaboration**: Can two people (e.g., a couple) contribute to the same book?

**Export/Portability**: If the service ever shuts down, can I export my book to a PDF or a physical print-on-demand service? This is a major selling point for "journaling" apps.

## Reference Links

### Design

- page ideas: https://benomadpt.com/products/travel-book
- figma: https://www.figma.com/design/fbJetSJm9PbxAsOqDnpvG7/Travel-Book?node-id=54198-66&p=f&t=hX0FHvQySuNl1V2Y-0
- storyteller gameplay: https://www.youtube.com/watch?v=MNZFmLQBR4I
- css flipbook tutorial: https://www.youtube.com/watch?v=W6K26i9FwZU

### Data

- city data: https://simplemaps.com/data/world-cities
- country boundaries:
- country dishes: https://www.tasteatlas.com/ (data scraped with [tasteatlas-scraper](github.com/ricardofig016/tasteatlas-scraper))
- calling code (idd>root+idd>suffixes), capital, area, population, timezones, continents, name (nativeName), currencies, languages, coatOfArms(svg): https://restcountries.com/v3.1/name/{name}?fields
