# Travel Book - Repository Architecture

```plaintext
travel-book/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml                          # GitHub Pages deployment automation
│   │   └── supabase-keepalive.yml              # Supabase database keep-alive cron job
│   └── copilot-instructions.md                 # AI agent instructions
├── .vscode/
│   └── settings.json                           # Workspace-specific VS Code settings
├── supabase/
│   └── schema.sql                              # Database schema
├── public/
│   ├── assets/
│   │   ├── icons/
│   │   │   ├── map-icon.svg
│   │   │   ├── albums-icon.svg
│   │   │   ├── stats-icon.svg
│   │   │   └── compass-icon.svg
│   │   ├── images/
│   │   │   ├── book-textures/
│   │   │   │   ├── paper-texture.png
│   │   │   │   ├── aged-paper.png
│   │   │   │   └── page-shadows.png
│   │   │   └── markers/
│   │   │       ├── visited-marker.svg
│   │   │       ├── favorite-marker.svg
│   │   │       └── wishlist-marker.svg
│   │   └── fonts/
│   │       ├── playfair-display.ttf            # Serif headers
│   │       ├── roboto.ttf                      # Sans-serif body
│   │       └── indie-flower.ttf                # Handwritten notes
│   ├── favicon.ico                             # Browser tab icon
│   ├── robots.txt                              # SEO & crawlers
│   └── manifest.json                           # PWA manifest
├── src/
│   ├── main.ts                                 # Application entry point
│   ├── index.html                              # HTML shell
│   ├── styles.scss                             # Global styles
│   ├── styles/
│   │   ├── _variables.scss                     # Color palette, fonts, spacing vars
│   │   ├── _typography.scss                    # Font declarations, mixins
│   │   ├── _reset.scss                         # Browser reset/normalize
│   │   ├── _animations.scss                    # Global animation keyframes
│   │   └── _utilities.scss                     # Helper classes (margins, padding, etc)
│   └── app/
│       ├── app.config.ts                       # Root Angular config
│       ├── app.routes.ts                       # Root routing configuration
│       ├── app.component.ts/scss/html          # Root component
│       ├── core/                               # Core modules & infrastructure
│       │   ├── guards/                         # Route guards
│       │   │   └── auth.guard.ts               # Authentication guard
│       │   ├── interceptors/                   # HTTP interceptors
│       │   │   ├── supabase.interceptor.ts     # Auth headers, API setup
│       │   │   └── error.interceptor.ts        # Global error handling
│       │   ├── config/
│       │   │   ├── environment.ts              # Dev environment config (dev only)
│       │   │   ├── environment.prod.ts         # Prod environment config (dev only)
│       │   │   └── constants.ts                # API endpoints & constants
│       │   └── modules/
│       │       └── core-feature.module.ts      # Core feature with providers
│       ├── pages/                              # Full-page components (one per route)
│       │   ├── book-cover/
│       │   │   └── book-cover.component.ts/html/scss
│       │   ├── book-index/
│       │   │   └── book-index.component.ts/html/scss
│       │   ├── world-map/
│       │   │   ├── world-map.component.ts/html/scss
│       │   │   └── world-map.module.ts         # Lazy-loaded feature module
│       │   ├── photo-albums/
│       │   │   ├── photo-albums.component.ts/html/scss
│       │   │   └── photo-albums.module.ts
│       │   └── statistics/
│       │       ├── statistics.component.ts/html/scss
│       │       └── statistics.module.ts
│       ├── features/                           # Feature modules (grouped by domain)
│       │   ├── map/
│       │   │   ├── map.module.ts               # Shared map module
│       │   │   ├── components/
│       │   │   │   ├── world-map/
│       │   │   │   │   └── world-map.component.ts/html/scss
│       │   │   │   ├── map-controls/           # Zoom, pan controls
│       │   │   │   │   └── map-controls.component.ts/html/scss
│       │   │   │   ├── map-canvas/
│       │   │   │   │   └── map-canvas.component.ts/html/scss
│       │   │   │   ├── city-list/
│       │   │   │   │   └── city-list.component.ts/html/scss
│       │   │   │   ├── marker-form/
│       │   │   │   │   └── marker-form.component.ts/html/scss
│       │   │   │   └── marker-details/
│       │   │   │       └── marker-details.component.ts/html/scss
│       │   │   ├── services/
│       │   │   │   ├── map.service.ts                          # Geographic data & state
│       │   │   │   ├── marker.service.ts                       # Marker CRUD (Supabase)
│       │   │   │   ├── marker-visits.service.ts                # Visit periods CRUD
│       │   │   │   ├── city.service.ts                         # City database queries
│       │   │   │   ├── dish.service.ts                         # Dish data queries
│       │   │   │   ├── user-tried-dishes.service.ts            # Track tried dishes
│       │   │   │   └── country.service.ts                      # Country data & boundaries
│       │   │   └── models/
│       │   │       ├── marker.model.ts
│       │   │       ├── marker-visit.model.ts
│       │   │       ├── city.model.ts
│       │   │       ├── country.model.ts
│       │   │       └── dish.model.ts
│       │   ├── albums/
│       │   │   ├── albums.module.ts                            # Album feature module
│       │   │   ├── components/
│       │   │   │   ├── photo-album/                            # Main album container
│       │   │   │   │   └── photo-album.component.ts/html/scss
│       │   │   │   ├── album-spread/                           # Two-page spread view
│       │   │   │   │   └── album-spread.component.ts/html/scss
│       │   │   │   └── album-photo/                            # Individual photo with tape effect
│       │   │   │       └── album-photo.component.ts/html/scss
│       │   │   ├── services/
│       │   │   │   ├── album.service.ts                        # Album data management
│       │   │   │   └── album-layout.service.ts                 # Photo placement logic
│       │   │   └── models/
│       │   │       └── album.model.ts
│       │   ├── navigation/
│       │   │   ├── navigation.module.ts                        # Navigation feature module
│       │   │   ├── components/
│       │   │   │   └── navigation-bookmarks/
│       │   │   │       └── navigation-bookmarks.component.ts/html/scss
│       │   │   └── services/
│       │   │       ├── navigation.service.ts                   # Route transitions
│       │   │       └── bookmark-position.service.ts            # Dynamic positioning logic
│       │   └── animations/
│       │       ├── animations.module.ts                        # Animation infrastructure
│       │       ├── directives/
│       │       │   ├── page-flip.directive.ts                  # Reusable flip animation
│       │       │   └── fade-in.directive.ts                    # Other animation triggers
│       │       └── services/
│       │           ├── animation.service.ts                    # Coordinate all animations
│       │           ├── page-flip.service.ts                    # Flip calculation logic
│       │           └── gsap-wrapper.service.ts                 # GSAP abstraction layer
│       ├── shared/                                             # Reusable components & utilities (across features)
│       │   ├── shared.module.ts                                # Declare & export shared items
│       │   ├── components/
│       │   │   ├── book-page/
│       │   │   │   └── book-page.component.ts/html/scss        # Base page styling wrapper
│       │   │   ├── button/
│       │   │   │   └── button.component.ts/html/scss
│       │   │   ├── modal-dialog/
│       │   │   │   └── modal-dialog.component.ts/html/scss
│       │   │   ├── image-uploader/
│       │   │   │   └── image-uploader.component.ts/html/scss
│       │   │   ├── loading-spinner/
│       │   │   │   └── loading-spinner.component.ts/html/scss
│       │   │   ├── error-message/
│       │   │   │   └── error-message.component.ts/html/scss
│       │   │   └── notification/
│       │   │       └── notification.component.ts/html/scss
│       │   ├── pipes/
│       │   │   ├── date-range.pipe.ts                          # Format visit date ranges
│       │   │   ├── safe-html.pipe.ts                           # Sanitize HTML for display
│       │   │   └── placeholder-image.pipe.ts                   # Fallback for missing photos
│       │   ├── directives/
│       │   │   ├── click-outside.directive.ts                  # Close modals on outside click
│       │   │   ├── debounce.directive.ts                       # Debounce rapid clicks
│       │   │   └── image-lazy-load.directive.ts                # Lazy load photos
│       │   └── models/
│       │       └── common.model.ts                             # Shared type definitions
│       └── services/
│           ├── data/
│           │   ├── storage.service.ts                          # Local storage management
│           │   ├── supabase.service.ts                         # Supabase SDK wrapper
│           │   └── cloudinary.service.ts                       # Cloudinary integration
│           └── utilities/
│               ├── logger.service.ts                           # Logging & debugging
│               └── error-handler.service.ts                    # Global error management
├── .editorconfig                               # IDE coding style consistency
├── .gitignore                                  # Git ignore rules
├── .env.example                                # Environment variables template
├── tsconfig.json                               # TypeScript base config
├── tsconfig.app.json                           # TypeScript app config
├── tsconfig.spec.json                          # TypeScript test config
├── angular.json                                # Angular CLI config
├── package.json                                # Dependencies & scripts
├── package-lock.json                           # Dependency lock file
├── README.md                                   # Project overview
├── PROJECT_SPEC.md                             # Feature specifications
├── ARCHITECTURE.md                             # This file
└── karma.conf.js                               # Test runner configuration
```
