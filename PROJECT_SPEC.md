# Travel Book

## Overview

Personal travel journal web app using a physical book metaphor. Navigation flow:
Cover -> Account -> Map -> Album -> Statistics -> Back Cover.

## Stack + Services

- Angular (TypeScript), npm, GitHub Pages.
- Supabase for markers/cities/notes (keep-alive cron every 2 days).
- Cloudinary for photo storage.
- Local storage for cache/session state.

## Core UX

- **Navbar**:
  - Book selector dropdown (Demo Book + user's books) and Create New Book action
    - Demo Book has a "Hide Demo Book" button visible only in the dropdown (small icon/button next to the book name)
    - When clicked, hides the demo book from the user's book list (preference stored in user_profiles.hide_demo_book)
    - Non-authenticated users always see the demo book
  - Create book button: visible if authenticated; creates new book with name and members and auto-selects it
  - Export Button: generates a PDF copy of the entire book including cover, map, album, and statistics.
- **Book Cover**: click to open with a page flip to Account.
- **Account**:
  - user account/authentication page on the back of the front cover, with a passport where the user can sign up, sign in, sign out and view their profile information.
  - entry page (page 1) with title, logo, description, and authorship info.
- **World Map**:
  - Minimal map: manually rendered country shapes from static file `visvalingam-weighted_1.8pct_keepshapes_clean.geojson`.
  - Hierarchy: Country level only (MVP).
  - Countries automatically filled based on markers (user's home country colored distinctly from visited countries).
  - Click country -> country modal with:
    - Searchable city list -> marker form
    - Country entry page link (/album/:countrySlug)
    - Marker list with marker links to album pages (/album/:countrySlug/:citySlug--:idTail)
  - Marker details view with "See Album" if photos exist.
- **Photo Album**:
  - Album is divided into countries (if there's a marker in that country), and each country is divided into cities (if there's a marker in that city).
  - Routing structure (hybrid, human-readable + stable tail id):
    - `/album` -> album landing page.
    - `/album/:countrySlug` -> country index page in album context.
    - `/album/:countrySlug/:citySlug--:idTail` -> city marker album page, where `idTail` is the last 12 characters of the marker UUID.
  - Route matching and lookup rules:
    - `:citySlug--:idTail` is the canonical city-marker route format.
    - `idTail` (last 12 characters) is used to narrow marker lookup, then validated against the selected book context.
    - Slugs are for readability and navigation; the identifier tail is the stability anchor.
    - If a slug does not match canonical marker/city/country naming, the app should redirect to the canonical route.
  - Each country is divided into:
    - an entry page with country metadata (capital, population, flag, coat of arms, etc) and book specific info (markers, dishes tried, etc).
    - several city sections (each representing a marker) each with enough pages for all the photos of that marker. Each city section starts with a city entry page with marker specific info, followed by photo pages.
  - Scrapbook two-page spreads; taped/rotated photos; page flip navigation.
  - Each page is selected from one of the template layouts. There's layouts for pages with 2 and 3 photos. Layouts have designated areas for photos, captions, doodles, etc. Photo rotation is random within a small angle range to create a casual, scrapbook feel. Layouts are dynamically selected so that every city section has at least one free photo slot for adding new photos, and the last page of a city section is always on the right side of the spread, so that the next city section can start on a new spread.
  - Album are sorted alphabetically by country name, then city name.
  - Photos on a city's marker are sorted by date taken.
  - Photo page layouts are selected randomly at render time, with constraints to ensure that the last photo page of a city album:
    - has a free photo slot to add new photos
    - is on the right side of the spread
- **Bookmarks**: persistent tabs; dynamic positioning by section.

## Collaboration Model

- **Books**: containers for shared travel data (name, visibility)
- **Book Members**: users collaborating on a book (no roles, equal access)
- **Book Creation**: specify a list of emails at creation; no ability to add/remove members after creation (MVP)
- **Public Demo Book**: one pre-seeded showcase book with fake data, visible without login (is_public = true); all other books are private (is_public = false)
- **Shared State**: all book members share dishes, markers, photos, and visits (no per-user distinction)

## Database Schema (see `supabase/schema.sql`)

- **Books**: name, is_public (for demo book)
- **Book Members**: links users to books (no ownership, equal access)
- **Countries**: name, native name, ISO codes, capital (city ref), area, population, coordinates, landlocked, borders, continents, subregion, timezones, languages, calling codes, car info, flag data, coat of arms, GeoJSON boundaries
  - `countries.geometry` can be populated from `supabase/data/visvalingam-weighted_1.8pct_keepshapes_clean.geojson` via `supabase/scripts/seed_country_shapes.py`
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

## Reference Links

### Design

- page ideas: https://benomadpt.com/products/travel-book
- figma: https://www.figma.com/design/fbJetSJm9PbxAsOqDnpvG7/Travel-Book?node-id=54198-66&p=f&t=hX0FHvQySuNl1V2Y-0
- storyteller gameplay: https://www.youtube.com/watch?v=MNZFmLQBR4I
- css flipbook tutorial: https://www.youtube.com/watch?v=W6K26i9FwZU

### Data

- city data: https://simplemaps.com/data/world-cities
- country boundaries: https://datahub.io/core/geo-countries
- country dishes: https://www.tasteatlas.com/ (data scraped with [tasteatlas-scraper](github.com/ricardofig016/tasteatlas-scraper))
- country data (name, nativeName, capital, area, population, latlng, landlocked, borders, continents, subregion, timezones, languages, calling codes, car signs/side, googleMaps, coatOfArms, flag, currencies): https://restcountries.com/v3.1/name/{name}?fields
