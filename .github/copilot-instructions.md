# Travel Book - Workspace Instructions

Digital travel journal built with Angular 19 and a physical-book UI metaphor.

Use these docs as source of truth for product intent and planned structure:

- `PROJECT_SPEC.md`
- `ARCHITECTURE.md`
- `supabase/schema.sql`

## Code Style

Angular standards for new code:

- Use standalone components (`standalone: true`).
- Prefer `inject()` over constructor injection in newly written or refactored code.
- Use signals (`signal`, `computed`, `effect`) for local reactive state.
- Use `ChangeDetectionStrategy.OnPush` for non-trivial components.
- Use `styleUrl` (singular) and SCSS.

TypeScript standards:

- Keep strict typing (`strict` is enabled in `tsconfig.json`).
- Avoid `any`; use concrete types or `unknown` and narrow.
- Keep ES2022-compatible code.

Naming conventions:

- Selector prefix: `app-`
- File names: kebab-case (example: `book-cover.component.ts`)
- Class names: PascalCase
- Methods/variables: camelCase

## Architecture

Current implementation is an early scaffold:

- Routes and page shells live in `src/app/pages/`.
- Root app setup is in `src/app/app.config.ts`, `src/app/app.routes.ts`, and `src/app/app.component.ts`.
- Config/constants live in `src/app/core/config/`.
- Data service folders exist at `src/app/services/` but are mostly not implemented yet.

Target architecture (documented, partially not yet implemented):

- Feature areas under `src/app/features/`.
- Shared reusable UI/utilities under `src/app/shared/`.
- Service layer for storage/Supabase/Cloudinary under `src/app/services/`.

When adding new features:

- Follow documented boundaries from `ARCHITECTURE.md`.
- Prefer lazy-loaded route areas for larger features.
- Keep data flow normalized around Supabase schema (countries -> cities -> markers -> visits/photos).

## Build And Test

Use these npm scripts:

- `npm start` -> Angular dev server (`ng serve`)
- `npm run watch` -> dev build watch mode
- `npm run build` -> production build
- `npm test` -> Karma/Jasmine tests

Deployment details:

- GitHub Pages workflow: `.github/workflows/deploy.yml`
- Production build for pages must use base href `/travel-book/`
- Deployed artifact path: `dist/travel-book/browser`

## Conventions

Routing and UX flow:

- Preserve navigation flow: Cover -> Index -> Map -> Albums -> Statistics (expand toward full spec flow as features are added).
- For page-flip transitions, block competing navigation until animation completes.

Data and integration:

- Use `src/app/core/config/environment.ts` and `src/app/core/config/environment.prod.ts` for environment config.
- Keep constants in `src/app/core/config/constants.ts`.
- Supabase is the persistent data source; Cloudinary is for photo storage metadata + asset lifecycle.

Database modeling rules:

- Do not duplicate city coordinates on markers.
- Keep many-to-many data in join tables (example: `user_tried_dishes`).
- Keep visit periods in `marker_visits`, not JSON blobs.
- Keep photo metadata in `photos` with Cloudinary `public_id`.

## Testing

Always add tests for new features using Karma/Jasmine:

- Test runner: `npm test` (runs `ng test`, headless Chrome).
- Place test files adjacent to implementation: `component/name.component.spec.ts`.
- Current test coverage is minimal (only 1 basic test for root app); help expand coverage.
- Patterns to test:
  - Service methods (mocking Supabase with `jasmine.createSpyObj`).
  - Component signal state and reactivity (`effect()` subscriptions).
  - Page navigation and route transitions.
  - Error handling (e.g., failed Supabase queries, network timeouts).

Example test structure:

```typescript
describe("MarkerService", () => {
  let service: MarkerService;
  let supabase: jasmine.SpyObj<SupabaseService>;

  beforeEach(() => {
    supabase = jasmine.createSpyObj("SupabaseService", ["client"]);
    TestBed.configureTestingModule({
      providers: [MarkerService, { provide: SupabaseService, useValue: supabase }],
    });
    service = TestBed.inject(MarkerService);
  });

  it("should fetch markers for a book", async () => {
    // test implementation
  });
});
```

## Service Implementation Pattern

When adding domain services (e.g., `marker.service.ts`, `city.service.ts`):

1. **Use `inject()`** to get `SupabaseService` (or other dependencies).
2. **Return Promises or Observables** from query methods for integration with signals/effects.
3. **Handle errors gracefully**:
   - Log to console (or error reporting service in future).
   - Provide fallback data or rethrow for caller to handle.
4. **Example structure**:

   ```typescript
   import { Injectable } from "@angular/core";
   import { inject } from "@angular/core";
   import { SupabaseService } from "./supabase.service";

   @Injectable({ providedIn: "root" })
   export class MarkerService {
     private supabase = inject(SupabaseService);

     async getMarkers(bookId: string) {
       try {
         const { data, error } = await this.supabase.client.from("markers").select("*").eq("book_id", bookId);
         if (error) throw error;
         return data ?? [];
       } catch (err) {
         console.error("Failed to fetch markers:", err);
         throw err;
       }
     }
   }
   ```

## Environment & Secrets

- Use `src/app/core/config/environment.ts` (dev) and `environment.prod.ts` (production).
- Supabase URL and anon key **must** come from environment variables at build time.
- **Never commit secrets**; store in GitHub Secrets and pass via `--configuration` or env vars during build.
- Free tier Supabase can sleep after inactivity; a cron job (`.github/workflows/supabase-keepalive.yml`) sends a minimal GET every 2 days.

## Database & RLS (Row-Level Security)

- Supabase stores data in Postgres with RLS enabled.
- **Critical**: Avoid self-referencing SELECT policies (e.g., in `book_members` table) as they can trigger infinite recursion; use `SECURITY DEFINER` helper functions instead (see repo memory notes).
- **Public demo book**: Only one book can have `is_public = true` (enforced via partial unique index). Do not treat this as sharing mechanism.
- For any data access, ensure RLS policies match your fetch queries.

## Pitfalls

- GitHub Pages routing breaks if base href is not `/travel-book/` in production build.
- Angular bundle budgets are strict (`500kB` warning / `1MB` error initial, `4kB` warning / `8kB` error component style).
- Supabase free tier can sleep; handle wake-up latency gracefully.
- Avoid unnecessary signals/RxJS mixing; use interop helpers when crossing boundaries.
- Constructor injection in components breaks tree-shaking and signals flow; always use `inject()` in new code.
- Page-flip transitions block navigation; ensure completion before allowing new routes.

## Current Implementation Status

This project is in **early scaffold**:

- **Pages**: 5 route shells exist (cover, index, map, albums, statistics) but are mostly placeholder (only book-cover is non-trivial).
- **Services**: Only `SupabaseService` exists; all domain services need implementation (map, marker, city, country, dish, etc.).
- **Core infrastructure**: No auth guards, no HTTP interceptors, no core feature module.
- **Features**: Directories `src/app/features/` and `src/app/shared/` do not exist yet.
- **Tests**: Minimal coverage; new features need corresponding test files.

When implementing features, refer to the target architecture in `ARCHITECTURE.md` and build incrementally. Prefer lazy-loaded feature modules for larger features.

## Key References

- `PROJECT_SPEC.md` — Product roadmap, UX flow, and feature specs.
- `ARCHITECTURE.md` — Full repository structure and component boundaries.
- `README.md` — Quick start and high-level overview.
- `supabase/schema.sql` — Database schema and RLS policies.
- `.github/workflows/deploy.yml` — GitHub Pages deployment.
- `.github/workflows/supabase-keepalive.yml` — Supabase read-alive cron job.
- Repository memory notes for RLS recursion and sharing conventions.
