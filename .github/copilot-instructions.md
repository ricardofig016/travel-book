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

- Supabase for markers, cities, geographic data (via `supabase.service.ts`)
- Cloudinary for photo storage (via `cloudinary.service.ts`)
- Keep-alive cron job hits Supabase every 2-3 days (free tier requirement)

**Navigation Flow:**
Cover → Index → Map → Albums → Statistics → Back Cover

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

**Colors (from PROJECT_SPEC.md):**

- Pages: `#F5F1E8`, `#E8DCC4` (aged paper)
- Sea: `#4A90E2` | Land: `#FFFFFF`
- Markers: visited `#8BC34A`, favorite `#FF5722`, wishlist `#FFC107`

**Typography:**

- Headers: Yrsa (serif) - classic book feel
- Body: Roboto (sans-serif) - readability
- Notes: Indie Flower (handwritten) - personal touch

**Styling:**

- SCSS only - partials in `src/styles/` (variables, typography, reset, animations, utilities)
- Scrapbook aesthetic: tape effects, photo rotation, soft shadows
- Budget: 4KB warning, 8KB error per component style

## External Services

**Supabase Configuration:**

- Tables: `markers`, `cities`, `countries`, `regions`
- Use environment variables from `src/app/core/config/environment.ts`
- Implement Row Level Security (RLS) policies
- Install dependency: `@supabase/supabase-js`

**Cloudinary:**

- Max upload: 10MB
- Formats: jpg, jpeg, png, webp, gif
- Cloud name: `dkpf6sa1o`
- Install dependency if needed

**Animation Library:**

- GSAP recommended for page flip animations
- Wrap in `gsap-wrapper.service.ts` for testability

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

## Current Implementation Status

**Phase 1** (Current): Basic skeleton exists

- ✅ 5 page components (placeholder only)
- ✅ Routing with guards configured
- ✅ Environment config ready
- ❌ Feature modules not implemented
- ❌ Shared components missing
- ❌ All services empty
- ❌ External SDKs not installed

**Next Priorities:**

1. Install Supabase and Cloudinary SDKs
2. Implement data services layer
3. Build map feature (hierarchy selector, marker mode, area mode)
4. Create shared UI components (book-page, modals, buttons)
5. Implement page flip animations

## Testing Strategy

**Unit Tests:**

- Karma + Jasmine configured
- Test files: `*.spec.ts` alongside components
- Mock external services (Supabase, Cloudinary)

**Coverage Expectations:**

- Services: 80%+ coverage
- Components: Focus on logic, not template rendering
- Use Angular testing utilities: `TestBed`, `ComponentFixture`

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
