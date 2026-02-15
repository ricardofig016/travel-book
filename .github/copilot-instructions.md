# Travel Book - AI Coding Agent Instructions

## Project Context
This is a **personal travel journal web app** using a physical book metaphor. Users navigate through interactive "pages" with flip animations, log cities with markers and photos, and visualize travels on a minimalist world map. Built as a passion project for two users, deployed on GitHub Pages with data stored externally.

## Architecture & Big Picture

### Book-Based Navigation Flow
**Cover → Index → Map → Albums → Statistics (future) → Back Cover**

The entire UX is a physical book simulation:
- **Book Cover**: Landing page, flip to open
- **Book Index**: Table of contents with clickable sections (map, albums, statistics)
- **World Map**: Main interface with hierarchy selector (Country/State/etc.) and dual display modes (Markers vs Area Highlighting)
- **Photo Albums**: Scrapbook-style pages with photos appearing "taped" on, navigated by clicking page corners
- **Bookmarks**: Persistent navigation tabs that change position based on page location (left/right edge)

### Core Components Structure
```
app/
├── core/
│   ├── book-cover/            # Landing page with flip animation
│   ├── book-index/            # Navigation hub / table of contents
│   ├── navigation-bookmarks/  # Dynamic bookmark position system
│   └── page-flip-animation/   # Reusable 3D page turning effect
├── map/
│   ├── world-map/             # Main interface
│   ├── map-controls/          # Hierarchy selector + display mode toggle
│   ├── map-canvas/            # Map rendering & interactions
│   ├── city-list/             # Zone cities with search
│   ├── marker-form/           # Add/edit city markers
│   └── marker-details/        # Marker info popup
├── albums/
│   └── photo-album/           # Scrapbook-style album spreads
├── shared/
│   ├── book-page/             # Base page styling component
│   ├── button/                # Themed buttons
│   ├── modal/                 # Dialogs
│   └── image-uploader/        # Cloudinary upload interface
└── services/
    ├── marker.service.ts      # Supabase CRUD for markers
    ├── photo.service.ts       # Cloudinary integration
    ├── map.service.ts         # Geographic data & state
    ├── navigation.service.ts  # Section transitions
    ├── animation.service.ts   # Page flip coordination
    └── storage.service.ts     # Local storage caching
```

## External Integrations

### Supabase (Data Storage)
- Stores: markers, city data, notes, metadata
- **Critical**: Keep-alive cron job configured in `.github/workflows/supabase-keepalive.yml` (pings every 2-3 days)
- Use environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Row-level security for private data

### Cloudinary (Photo Storage)
- All photos stored externally (repo is public, data is private)
- Frontend uploads via upload preset
- Environment variable: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`
- Implement lazy loading for album views

## Design Patterns & Conventions

### Color Palette (Vintage Book Aesthetic)
- **Pages**: `#F5F1E8` (cream), `#E8DCC4` (aged paper)
- **Sea**: `#4A90E2` (soft blue), `#5B9BD5` (map blue)
- **Land**: `#FFFFFF` (white)
- **Markers**: `#8BC34A` (visited/green), `#FF5722` (favorite/red), `#FFC107` (wishlist/amber)
- **Text**: `#2C2416` (dark brown), `#3E3428` (warm black)

### Map Display Modes
1. **Marker Mode**: Shows individual city pins with click interactions
2. **Area Highlighting Mode**: Colors entire regions (country/state) based on visit status and selected hierarchy

### Marker Data Structure
```typescript
{
  location: { city, country, state?, lat, lng },
  status: { visited, favorite, want },
  content: { notes, dates, companions, activities, photoUrls[] },
  metadata: { createdAt, updatedAt }
}
```

### Animation Philosophy
- Use GSAP (or similar) for smooth page flips - must feel like physical pages
- 3D transforms for realism (page curl effect)
- Animations are critical to the "magic" - not optional
- Trigger points: cover→index, section navigation, page corners, bookmarks

## Development Workflow

### Local Development
```bash
npm start                    # Dev server on localhost:4200
npm run watch                # Build with file watching
npm test                     # Run Karma tests
```

### Deployment (GitHub Pages)
- **Auto-deploys** on push to `main` via `.github/workflows/deploy.yml`
- Build output: `dist/travel-book/browser/`
- Base href: `/travel-book/` (configured in workflow)
- **Never commit** `dist/` folder (in `.gitignore`)
- Change GitHub Pages source to "GitHub Actions" (not branch)

### Phase-Based Development Order
1. **Phase 1**: Book cover, index, basic map, hierarchy selector
2. **Phase 2**: Marker management, display mode toggle, area highlighting
3. **Phase 3**: Cloudinary integration, photo uploads
4. **Phase 4**: Album feature with scrapbook layout, page navigation
5. **Phase 5**: Bookmark system, dynamic positioning, transitions
6. **Phase 6**: Responsive design, performance, error handling
7. **Phase 7**: Statistics chapter (future)

## Critical Implementation Notes

### Geographic Data
- Hierarchy: Country → State/District → (optional 3rd level)
- City lists sorted by **population** (largest first)
- Search functionality required within city lists
- Store coordinates for marker placement

### Local Storage Strategy
- Cache frequently accessed map data
- Persist user session state (current view, zoom, hierarchy level)
- Optimistic UI updates before Supabase confirmation

### Scrapbook Photo Layout
- Photos NOT in grid - organic, rotated placements (`transform: rotate()`)
- Visual "tape" effect on corners
- Slight shadows for depth
- Multiple photos per two-page spread

### Bookmark Positioning Logic
- **Closed book (cover)**: All bookmarks on right edge
- **Closed book (back)**: All bookmarks on left edge  
- **Open book (e.g., album)**: Map bookmark left, Statistics bookmark right, current section hidden/centered

## Key Files Reference
- **`PROJECT_SPEC.md`**: Complete feature specifications, component details, design inspiration
- **`angular.json`**: Build configuration, output paths
- **`.github/workflows/deploy.yml`**: GitHub Pages deployment automation
- **`.github/workflows/supabase-keepalive.yml`**: Database keep-alive job (add when Supabase is integrated)

## Common Pitfalls to Avoid
- Don't use generic map tiles from Google/Mapbox - use **simplistic white land, blue sea** SVG with borders
- Remember dual display modes (markers vs area highlighting) aren't just visual - they change entire interaction model
- Page flip animations must complete before allowing next interaction (prevent rapid clicking)
- Photos in albums must load from Cloudinary URLs, not local assets
- Environment variables for API keys must not be committed to repo

## References
- Full specification: `PROJECT_SPEC.md` (sections: Application Structure, Component Architecture, Design Aesthetics)
- Mood board links and design inspiration: `PROJECT_SPEC.md` → "Mood Board & Design Inspiration"
- Animation libraries to consider: GSAP, turn.js, StPageFlip
- Map libraries: Leaflet, D3.js for custom geographic visualizations
