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

- **Navbar**: Book selector dropdown (Demo Book + user's books) and Create New Book action
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

## Collaboration Model

- **Books**: containers for shared travel data (name, visibility)
- **Book Members**: users collaborating on a book (no roles, equal access)
- **Book Creation**: specify a list of emails at creation; no ability to add/remove members after creation (MVP)
- **Public Demo Book**: one pre-seeded book visible without login (showcase)
- **Shared State**: all book members share dishes, markers, photos, and visits (no per-user distinction)

## Database Schema (see `supabase/schema.sql`)

- **Books**: name, is_public (for demo book)
- **Book Members**: links users to books (no ownership, equal access)
- **Countries**: name, native name, ISO codes, capital (city ref), area, population, coordinates, landlocked, borders, continents, subregion, timezones, languages, calling codes, car info, flag data, coat of arms, GeoJSON boundaries
- **Currencies**: country junction with ISO codes, symbols, names
- **Cities** (~48k from SimpleMaps): name (Unicode + ASCII), country, admin region, population, coordinates
- **User Profiles**: home_city_id for home country coloring
- **Dishes** (TasteAtlas data): name, category, location, rating, image, country
- **Book Tried Dishes**: junction table tracking which dishes have been tried by a book's members
- **Markers**: book_id, city_id, status (visited/favorite/want), notes, companions, activities
- **Marker Visits**: start_date, end_date pairs for each visit to a marker
- **Photos**: marker_id, Cloudinary URL + public_id, date_taken, caption, uploaded_at

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
- country data (name, nativeName, capital, area, population, latlng, landlocked, borders, continents, subregion, timezones, languages, calling codes, car signs/side, googleMaps, coatOfArms, flag, currencies): https://restcountries.com/v3.1/name/{name}?fields
