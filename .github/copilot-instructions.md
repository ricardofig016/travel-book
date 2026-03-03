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

## Pitfalls

- GitHub Pages routing breaks if base href is not `/travel-book/` in production build.
- Angular bundle budgets are strict (`500kB` warning / `1MB` error initial, `4kB` warning / `8kB` error component style).
- Supabase free tier can sleep; handle wake-up latency gracefully.
- Avoid unnecessary signals/RxJS mixing; use interop helpers when crossing boundaries.

## Key References

- `PROJECT_SPEC.md`
- `ARCHITECTURE.md`
- `README.md`
- `.github/workflows/deploy.yml`
- `supabase/schema.sql`
