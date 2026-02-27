# Travel Book - AI Agent Instructions

A digital travel journal using Angular 19 and a physical book metaphor. See [PROJECT_SPEC.md](../PROJECT_SPEC.md) for features and [ARCHITECTURE.md](../ARCHITECTURE.md) for structure.

## Code Style

**Angular 19 Modern Patterns:**

- Use standalone components (`standalone: true`) - NO NgModules except for lazy-loaded feature modules
- Prefer `inject()` function over constructor injection for new code
- Use signals (`signal()`, `computed()`, `effect()`) for state management
- Apply OnPush change detection strategy: `changeDetection: ChangeDetectionStrategy.OnPush`
- Use `styleUrl` (singular) not deprecated `styleUrls`

**TypeScript:**

- Strict mode enabled - honor all type safety rules
- Target ES2022
- Avoid `any` - use proper typing or `unknown`

**Component Organization:**

- **Pages** (`src/app/pages/`): Full-page route components
- **Features** (`src/app/features/`): Domain-specific modules (map, albums, navigation, animations)
- **Shared** (`src/app/shared/`): Reusable cross-feature components, pipes, directives
- **Services** (`src/app/services/`): Data layer (storage, supabase, cloudinary) and utilities

**Naming Conventions:**

- Component selector prefix: `app-`
- File naming: kebab-case (`book-cover.component.ts`)
- Class names: PascalCase (`BookCoverComponent`)
- Methods/variables: camelCase (`openBook()`)

## Architecture

Reference [ARCHITECTURE.md](../ARCHITECTURE.md) for complete structure. Key principles:

**Lazy Loading:**

- Feature modules (map, albums, statistics) should be lazy-loaded
- Keep initial bundle under 500KB (warning threshold)

**State Management:**

- Use Angular signals for component state
- Services for shared state across features
- LocalStorage for persistence (use `storage.service.ts`)

**Data Flow:**

- Supabase for all persistent data (see schema below)
- Cloudinary for photo storage (via `cloudinary.service.ts`)
- Keep-alive cron job hits Supabase every 2-3 days (free tier requirement)

**Database Design Principles:**

- **Normalized Structure**: Countries → Cities → Markers → Photos/Visits
- **No Redundancy**: Lat/lng stored only in cities table, not markers
- **Proper Relations**: Use foreign keys, avoid JSONB for structured data
- **Separate Tables for Many-to-Many**: `user_tried_dishes` junction table
- **Visit Tracking**: `marker_visits` table for multiple visit periods per marker
- **Photo Management**: `photos` table with Cloudinary metadata (url, public_id)

**Navigation Flow:**
Cover → Index → Map → Country Entry (cities + dishes) → Albums → Statistics → Back Cover

## Build and Test

**Development:**

```bash
npm start          # Start dev server at localhost:4200
npm run watch      # Build with watch mode
```

**Testing:**

```bash
npm test           # Run Karma/Jasmine tests
```

**Production:**

```bash
npm run build      # Production build to dist/travel-book/browser/
```

**Deployment:**

- GitHub Pages via `.github/workflows/deploy.yml`
- Base href MUST be `/travel-book/`
- Output directory: `dist/travel-book/browser/`

## Design System

**Typography:**

- Headers: Yrsa (serif) - classic book feel
- Body: Roboto (sans-serif) - readability
- Notes: Indie Flower (handwritten) - personal touch

**Styling:**

- SCSS only - partials in `src/styles/` (variables, typography, reset, animations, utilities)
- Scrapbook aesthetic: tape effects, photo rotation, soft shadows
- Budget: 4KB warning, 8KB error per component style

## External Services

**Supabase Database Schema** (see `supabase/schema.sql`):

- **Tables**: `countries`, `cities` (~48k from SimpleMaps), `user_profiles`, `dishes` (TasteAtlas), `user_tried_dishes`, `markers`, `marker_visits`, `photos`
- **Key Relationships**: Markers → Cities → Countries; Photos → Markers; Marker Visits → Markers
- Use environment variables from `src/app/core/config/environment.ts`
- Row Level Security (RLS) policies enforced on all tables
- Install dependency: `@supabase/supabase-js`

**Cloudinary Photo Storage:**

- Photos table stores: `url`, `public_id`, `date_taken`, `caption`, `uploaded_at`
- Max upload: 10MB
- Formats: jpg, jpeg, png, webp, gif
- Cloud name: `dkpf6sa1o`
- Use `public_id` for delete/update operations

**Animation Library:**

- GSAP recommended for page flip animations
- Wrap in `gsap-wrapper.service.ts` for testability

## Database Schema Details

**Core Tables:**

1. **countries** - Geographic data with ISO codes and GeoJSON boundaries
2. **cities** (~48k) - SimpleMaps data: name (Unicode + ASCII), country_id, admin_name, population, lat/lng
3. **user_profiles** - User settings: home_city_id for home country coloring
4. **dishes** - TasteAtlas data: name, category, location, rating, image_url, country_id
5. **user_tried_dishes** - Junction table: user_id, dish_id, tried_at
6. **markers** - User markers: user_id, city_id, status (visited/favorite/want), notes, companions, activities
7. **marker_visits** - Visit periods: marker_id, start_date, end_date
8. **photos** - Photo metadata: marker_id, url, public_id, date_taken, caption

**Key Design Decisions:**

- Coordinates stored ONLY in cities table (markers inherit via city_id)
- Visit dates in separate table (not JSONB) for better queryability
- Tried dishes in separate table (not JSONB in user_profiles)
- Photos in separate table (not URL array in markers) - enables metadata + Cloudinary management
- SimpleMaps ID preserved for data consistency across updates
- Admin name stored for future scalability (currently country-level only MVP)

## Conventions

**Page Flip Animation:**

- Required for: section transitions, album navigation
- Block new navigation until flip completes
- Use directive for reusability: `page-flip.directive.ts`

**Environment Files:**

- `environment.ts` - Development config (NOT committed with secrets)
- `environment.prod.ts` - Production config (file replacement in angular.json)
- Use `.env.example` for documenting required variables

**Constants:**

- Define in `src/app/core/config/constants.ts`
- Includes: API endpoints, table names, cache expiry, storage keys, error messages

**Asset Organization:**

- Static assets in `public/assets/`
- Fonts: `fonts/indie-flower/`, `fonts/yrsa/`, `fonts/wonderling/`
- Images: `images/book/`, `images/icons/`, `images/ribbons/`

## Common Pitfalls

**GitHub Pages Deployment:**

- Always use `/travel-book/` base href in production builds
- Path references must be relative or absolute with base href

**Supabase Free Tier:**

- Database pauses after inactivity - keep-alive workflow required
- Implement graceful handling of wake-up delays

**Bundle Size:**

- Be cautious with third-party libraries
- Lazy load features to stay under budget
- Use tree-shakeable imports

**Angular Signals:**

- Don't mix signals with RxJS observables unnecessarily
- Use `toSignal()` and `toObservable()` for interop

## Reference Files

- [PROJECT_SPEC.md](../PROJECT_SPEC.md) - Feature requirements and visual design
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Complete file structure and component organization
- [README.md](../README.md) - Project overview
- [.github/workflows/deploy.yml](workflows/deploy.yml) - Deployment automation
