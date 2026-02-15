# Travel Book - Repository Architecture

```plaintext
travel-book/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml                    # GitHub Pages deployment automation
│   │   └── supabase-keepalive.yml       # Supabase database keep-alive cron
│   └── copilot-instructions.md          # AI agent instructions
├── .vscode/
│   └── settings.json                     # Workspace-specific VS Code settings
├── public/
│   ├── favicon.ico                       # Browser tab icon
│   ├── robots.txt                        # SEO & crawlers
│   └── manifest.json                     # PWA manifest (future)
├── src/
│   ├── main.ts                          # Application entry point
│   ├── index.html                       # HTML shell
│   ├── styles.scss                      # Global styles
│   ├── styles/
│   │   ├── _variables.scss              # Color palette, fonts, spacing vars
│   │   ├── _typography.scss             # Font declarations, mixins
│   │   ├── _reset.scss                  # Browser reset/normalize
│   │   ├── _animations.scss             # Global animation keyframes
│   │   └── _utilities.scss              # Helper classes (margins, padding, etc)
│   ├── app/
│   │   ├── app.config.ts                # Root Angular config
│   │   ├── app.routes.ts                # Root routing configuration
│   │   ├── app.component.ts/scss/html   # Root component
│   │   ├── core/                        # Core modules & infrastructure
│   │   │   ├── guards/                  # Route guards
│   │   │   │   └── auth.guard.ts        # Authentication guard (future)
│   │   │   ├── interceptors/            # HTTP interceptors
│   │   │   │   ├── supabase.interceptor.ts      # Auth headers, API setup
│   │   │   │   └── error.interceptor.ts        # Global error handling
│   │   │   ├── config/
│   │   │   │   ├── environment.ts       # Dev environment config (dev only)
│   │   │   │   ├── environment.prod.ts  # Prod environment config (dev only)
│   │   │   │   └── api.config.ts        # API endpoints & constants
│   │   │   └── modules/
│   │   │       └── core-feature.module.ts      # Core feature with providers
│   │   ├── pages/                       # Full-page components (one per route)
│   │   │   ├── book-cover/
│   │   │   │   ├── book-cover.component.ts
│   │   │   │   ├── book-cover.component.html
│   │   │   │   └── book-cover.component.scss
│   │   │   ├── book-index/
│   │   │   │   ├── book-index.component.ts
│   │   │   │   ├── book-index.component.html
│   │   │   │   └── book-index.component.scss
│   │   │   ├── world-map/
│   │   │   │   ├── world-map.component.ts
│   │   │   │   ├── world-map.component.html
│   │   │   │   ├── world-map.component.scss
│   │   │   │   └── world-map.module.ts  # Lazy-loaded feature module
│   │   │   ├── photo-albums/
│   │   │   │   ├── photo-albums.component.ts
│   │   │   │   ├── photo-albums.component.html
│   │   │   │   ├── photo-albums.component.scss
│   │   │   │   └── photo-albums.module.ts
│   │   │   └── statistics/               # Future feature
│   │   │       ├── statistics.component.ts
│   │   │       ├── statistics.component.html
│   │   │       ├── statistics.component.scss
│   │   │       └── statistics.module.ts
│   │   ├── features/                    # Feature modules (grouped by domain)
│   │   │   ├── map/
│   │   │   │   ├── map.module.ts                              # Shared map module
│   │   │   │   ├── components/
│   │   │   │   │   ├── world-map/
│   │   │   │   │   │   ├── world-map.component.ts
│   │   │   │   │   │   ├── world-map.component.html
│   │   │   │   │   │   └── world-map.component.scss
│   │   │   │   │   ├── map-controls/
│   │   │   │   │   │   ├── map-controls.component.ts         # Hierarchy selector + mode toggle
│   │   │   │   │   │   ├── map-controls.component.html
│   │   │   │   │   │   └── map-controls.component.scss
│   │   │   │   │   ├── map-canvas/
│   │   │   │   │   │   ├── map-canvas.component.ts
│   │   │   │   │   │   ├── map-canvas.component.html
│   │   │   │   │   │   └── map-canvas.component.scss
│   │   │   │   │   ├── city-list/
│   │   │   │   │   │   ├── city-list.component.ts
│   │   │   │   │   │   ├── city-list.component.html
│   │   │   │   │   │   └── city-list.component.scss
│   │   │   │   │   ├── marker-form/
│   │   │   │   │   │   ├── marker-form.component.ts
│   │   │   │   │   │   ├── marker-form.component.html
│   │   │   │   │   │   └── marker-form.component.scss
│   │   │   │   │   └── marker-details/
│   │   │   │   │       ├── marker-details.component.ts
│   │   │   │   │       ├── marker-details.component.html
│   │   │   │   │       └── marker-details.component.scss
│   │   │   │   ├── services/
│   │   │   │   │   ├── map.service.ts                        # Geographic data & state
│   │   │   │   │   ├── marker.service.ts                     # Marker CRUD (Supabase)
│   │   │   │   │   ├── geo-hierarchy.service.ts              # Hierarchy logic
│   │   │   │   │   ├── map-display-mode.service.ts           # Markers vs Area mode
│   │   │   │   │   └── city.service.ts                       # City database queries
│   │   │   │   └── models/
│   │   │   │       ├── marker.model.ts
│   │   │   │       ├── city.model.ts
│   │   │   │       ├── hierarchy.model.ts
│   │   │   │       └── display-mode.model.ts
│   │   │   ├── albums/
│   │   │   │   ├── albums.module.ts                          # Album feature module
│   │   │   │   ├── components/
│   │   │   │   │   ├── photo-album/
│   │   │   │   │   │   ├── photo-album.component.ts          # Main album container
│   │   │   │   │   │   ├── photo-album.component.html
│   │   │   │   │   │   └── photo-album.component.scss
│   │   │   │   │   ├── album-spread/
│   │   │   │   │   │   ├── album-spread.component.ts         # Two-page spread view
│   │   │   │   │   │   ├── album-spread.component.html
│   │   │   │   │   │   └── album-spread.component.scss
│   │   │   │   │   └── album-photo/
│   │   │   │   │       ├── album-photo.component.ts          # Individual photo with tape effect
│   │   │   │   │       ├── album-photo.component.html
│   │   │   │   │       └── album-photo.component.scss
│   │   │   │   ├── services/
│   │   │   │   │   ├── album.service.ts                      # Album data management
│   │   │   │   │   └── album-layout.service.ts               # Photo placement logic
│   │   │   │   └── models/
│   │   │   │       └── album.model.ts
│   │   │   ├── navigation/
│   │   │   │   ├── navigation.module.ts                      # Navigation feature module
│   │   │   │   ├── components/
│   │   │   │   │   └── navigation-bookmarks/
│   │   │   │   │       ├── navigation-bookmarks.component.ts
│   │   │   │   │       ├── navigation-bookmarks.component.html
│   │   │   │   │       └── navigation-bookmarks.component.scss
│   │   │   │   └── services/
│   │   │   │       ├── navigation.service.ts                 # Route transitions
│   │   │   │       └── bookmark-position.service.ts          # Dynamic positioning logic
│   │   │   └── animations/
│   │   │       ├── animations.module.ts                      # Animation infrastructure
│   │   │       ├── directives/
│   │   │       │   ├── page-flip.directive.ts                # Reusable flip animation
│   │   │       │   └── fade-in.directive.ts                  # Other animation triggers
│   │   │       └── services/
│   │   │           ├── animation.service.ts                  # Coordinate all animations
│   │   │           ├── page-flip.service.ts                  # Flip calculation logic
│   │   │           └── gsap-wrapper.service.ts               # GSAP abstraction layer
│   │   ├── shared/                      # Reusable components & utilities (across features)
│   │   │   ├── shared.module.ts                              # Declare & export shared items
│   │   │   ├── components/
│   │   │   │   ├── book-page/
│   │   │   │   │   ├── book-page.component.ts                # Base page styling wrapper
│   │   │   │   │   ├── book-page.component.html
│   │   │   │   │   └── book-page.component.scss
│   │   │   │   ├── button/
│   │   │   │   │   ├── button.component.ts
│   │   │   │   │   ├── button.component.html
│   │   │   │   │   └── button.component.scss
│   │   │   │   ├── modal-dialog/
│   │   │   │   │   ├── modal-dialog.component.ts
│   │   │   │   │   ├── modal-dialog.component.html
│   │   │   │   │   └── modal-dialog.component.scss
│   │   │   │   ├── image-uploader/
│   │   │   │   │   ├── image-uploader.component.ts
│   │   │   │   │   ├── image-uploader.component.html
│   │   │   │   │   └── image-uploader.component.scss
│   │   │   │   ├── loading-spinner/
│   │   │   │   │   ├── loading-spinner.component.ts
│   │   │   │   │   ├── loading-spinner.component.html
│   │   │   │   │   └── loading-spinner.component.scss
│   │   │   │   ├── error-message/
│   │   │   │   │   ├── error-message.component.ts
│   │   │   │   │   ├── error-message.component.html
│   │   │   │   │   └── error-message.component.scss
│   │   │   │   └── notification/
│   │   │   │       ├── notification.component.ts
│   │   │   │       ├── notification.component.html
│   │   │   │       └── notification.component.scss
│   │   │   ├── pipes/
│   │   │   │   ├── date-range.pipe.ts                        # Format visit date ranges
│   │   │   │   ├── safe-html.pipe.ts                         # Sanitize HTML for display
│   │   │   │   └── placeholder-image.pipe.ts                 # Fallback for missing photos
│   │   │   ├── directives/
│   │   │   │   ├── click-outside.directive.ts                # Close modals on outside click
│   │   │   │   ├── debounce.directive.ts                     # Debounce rapid clicks
│   │   │   │   └── image-lazy-load.directive.ts              # Lazy load photos
│   │   │   └── models/
│   │   │       └── common.model.ts                           # Shared type definitions
│   │   └── services/
│   │       ├── data/
│   │       │   ├── storage.service.ts                        # Local storage management
│   │       │   ├── supabase.service.ts                       # Supabase SDK wrapper
│   │       │   └── cloudinary.service.ts                     # Cloudinary integration
│   │       └── utilities/
│   │           ├── logger.service.ts                         # Logging & debugging
│   │           └── error-handler.service.ts                  # Global error management
│   └── assets/
│       ├── icons/
│       │   ├── map-icon.svg
│       │   ├── albums-icon.svg
│       │   ├── stats-icon.svg
│       │   └── compass-icon.svg
│       ├── images/
│       │   ├── book-textures/
│       │   │   ├── paper-texture.png
│       │   │   ├── aged-paper.png
│       │   │   └── page-shadows.png
│       │   └── markers/
│       │       ├── visited-marker.svg
│       │       ├── favorite-marker.svg
│       │       └── wishlist-marker.svg
│       └── fonts/
│           ├── playfair-display.ttf       # Serif headers
│           ├── roboto.ttf                 # Sans-serif body
│           └── indie-flower.ttf           # Handwritten notes
├── .editorconfig                         # IDE coding style consistency
├── .gitignore                            # Git ignore rules
├── .env.example                          # Environment variables template
├── tsconfig.json                         # TypeScript base config
├── tsconfig.app.json                     # TypeScript app config
├── tsconfig.spec.json                    # TypeScript test config
├── angular.json                          # Angular CLI config
├── package.json                          # Dependencies & scripts
├── package-lock.json                     # Dependency lock file
├── README.md                             # Project overview
├── PROJECT_SPEC.md                       # Feature specifications
├── ARCHITECTURE.md                       # This file
└── karma.conf.js                         # Test runner configuration
```
