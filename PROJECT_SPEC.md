# Travel Book - Project Specification

- [Travel Book - Project Specification](#travel-book---project-specification)
  - [Project Overview](#project-overview)
  - [Technical Stack](#technical-stack)
    - [Core Technologies](#core-technologies)
    - [External Services](#external-services)
    - [Data Storage](#data-storage)
  - [Application Structure](#application-structure)
    - [1. Book Cover (Landing Page)](#1-book-cover-landing-page)
    - [2. World Map (Main Interface)](#2-world-map-main-interface)
      - [Visual Design](#visual-design)
      - [Map Controls Menu](#map-controls-menu)
      - [Map Interactions](#map-interactions)
    - [3. Photo Albums](#3-photo-albums)
      - [Entry Point](#entry-point)
      - [Page Turning Animation](#page-turning-animation)
      - [Album Pages Layout](#album-pages-layout)
      - [Album End (Back Cover)](#album-end-back-cover)
    - [4. Navigation Bookmarks](#4-navigation-bookmarks)
    - [5. Statistics Chapter (Future Feature)](#5-statistics-chapter-future-feature)
  - [Data Structure Requirements](#data-structure-requirements)
    - [Marker Data Object](#marker-data-object)
    - [Geographic Data](#geographic-data)
    - [Local Storage](#local-storage)
  - [User Experience Flow](#user-experience-flow)
    - [Primary User Journey](#primary-user-journey)
    - [Navigation Patterns](#navigation-patterns)
  - [Animation Requirements](#animation-requirements)
    - [Page Flip Animations](#page-flip-animations)
    - [Other Animations](#other-animations)
  - [Responsive Design Considerations](#responsive-design-considerations)
    - [Desktop (Primary Target)](#desktop-primary-target)
    - [Tablet](#tablet)
    - [Mobile](#mobile)
  - [External Service Integration](#external-service-integration)
    - [Cloudinary Setup](#cloudinary-setup)
    - [Supabase Setup](#supabase-setup)
    - [GitHub Pages Deployment](#github-pages-deployment)
  - [Security \& Privacy](#security--privacy)
    - [Data Protection](#data-protection)
    - [Access Control](#access-control)
  - [Development Phases](#development-phases)
    - [Phase 1: Core Map Interface](#phase-1-core-map-interface)
    - [Phase 2: Marker Management](#phase-2-marker-management)
    - [Phase 3: Photo Integration](#phase-3-photo-integration)
    - [Phase 4: Album Feature](#phase-4-album-feature)
    - [Phase 5: Navigation System](#phase-5-navigation-system)
    - [Phase 6: Polish \& Optimization](#phase-6-polish--optimization)
    - [Phase 7: Statistics (Future)](#phase-7-statistics-future)
  - [Component Architecture](#component-architecture)
    - [Angular Components Structure](#angular-components-structure)
  - [Design Aesthetics](#design-aesthetics)
    - [Visual Theme](#visual-theme)
    - [Scrapbook Elements](#scrapbook-elements)
    - [Interactive Feedback](#interactive-feedback)
  - [Mood Board \& Design Inspiration](#mood-board--design-inspiration)
    - [Visual References](#visual-references)
    - [Color Palette Ideas](#color-palette-ideas)
    - [Typography References](#typography-references)
    - [UI/UX Inspiration](#uiux-inspiration)
    - [Animation References](#animation-references)
    - [Component Inspiration](#component-inspiration)
    - [Resource Links](#resource-links)
    - [Ideas to Consider](#ideas-to-consider)
  - [Performance Considerations](#performance-considerations)
    - [Optimization Strategies](#optimization-strategies)
    - [Loading States](#loading-states)
  - [Future Enhancements (Not Current Scope)](#future-enhancements-not-current-scope)
  - [Success Criteria](#success-criteria)
  - [Notes for Developers](#notes-for-developers)

## Project Overview

**Travel Book** is a personal web application designed as an interactive digital travel journal for logging and visualizing travels. The application uses a book metaphor throughout, where users navigate through pages, flip covers, and use bookmarks to access different sections.

**Purpose**: Personal portfolio project and private travel logger for two users (you and your girlfriend)

**Hosting**: GitHub Pages (public repository, private data stored externally)

---

## Technical Stack

### Core Technologies

- **Framework**: Angular (TypeScript)
- **Package Manager**: npm
- **Hosting**: GitHub Pages (static site)
- **Architecture**: Pure frontend application (no backend server)

### External Services

- **Cloudinary**: Photo storage and delivery
- **Supabase**: Data storage (places, markers, notes, metadata)
  - **Important**: Set up cron job to ping Supabase every few days to prevent instance sleep

### Data Storage

- All data stored and managed in frontend
- Local storage for session/cache
- No sensitive data in public repository

---

## Application Structure

### 1. Book Cover (Landing Page)

**Description**: The entry point of the application

**Components**:

- Display "Travel Book" as the cover title
- Cover design should resemble a physical book
- Interactive element: clicking anywhere on the cover triggers page flip animation

**Behavior**:

- On click: animate page flip transition to reveal the world map
- Bookmarks visible on the right edge of closed book

---

### 2. World Map (Main Interface)

**Description**: Interactive map for viewing and managing travel markers

#### Visual Design

- **Base Map**: Simplistic world map
  - Land: White
  - Sea: Blue
  - Borders: Visible based on selected hierarchy level
- **Layout**: Map takes up most of the page, side menu for controls

#### Map Controls Menu

**Hierarchy Selector**:

- Dropdown/select element with options:
  1. Country level (shows country borders)
  2. State/District level (shows state/district borders within countries)
  3. (Optional) Third hierarchy level for more granular regions
- Changing hierarchy updates:
  - Border display on map
  - Available clickable zones
  - Highlighting behavior in "Area" mode

**Display Mode Toggle**:
Two mutually exclusive modes:

1. **Marker Mode** (default):
   - Shows all marked cities as pins/markers on the map
   - Each marker indicates a city that has been logged
   - Markers can be clicked to view details
2. **Area Highlighting Mode**:
   - Hides individual markers
   - Colors in entire regions based on selected hierarchy and visits
   - Example behaviors:
     - If hierarchy = "States" and user visited Oliveira de Azeméis → Aveiro district is colored
     - If hierarchy = "Country" and user visited any city in Portugal → entire Portugal is colored
     - Unvisited land remains white
   - Purpose: Visualize travel coverage at different geographic scopes

#### Map Interactions

**Zone Selection**:

- User clicks on a zone (country, state, etc., depending on hierarchy)
- Triggers city list display

**City List**:

- Appears after zone selection
- Lists all cities in the selected zone
- Sorted by population (largest first)
- Includes search functionality to filter cities
- User can select a city from the list

**City Selection**:

- After selecting a city, a modal/box appears with options:
  - **Mark as**: Visited, Favorite, Want to visit (checkboxes/toggles)
  - **Add Details**: Text input for notes
  - **Upload Photos**: Interface to select and upload images to Cloudinary
  - **Date Information**: When visited / when planning to visit
  - **Companions**: Who they went with
  - **Activities/Sights**: What they saw/did
  - **Save Button**: Creates or updates the marker

**Marker Display**:

- Once saved, marker appears on map at city location (in Marker Mode)
- Visual differentiation for:
  - Visited cities
  - Favorite cities
  - Wishlist cities

**Marker Interaction**:

- Clicking an existing marker opens a details box showing:
  - City name
  - Short description (auto-generated or custom)
  - User notes (date, companions, activities, etc.)
  - "See Album" button (if photos exist)

---

### 3. Photo Albums

**Description**: Scrapbook-style photo viewing experience for each city

#### Entry Point

- Accessed by clicking "See Album" button from marker details box

#### Page Turning Animation

- Smooth animation simulating flipping through multiple pages
- Stops on the album for the selected city

#### Album Pages Layout

- **Two-page spread**:
  - City name centered at the top of the spread
  - Photos arranged in scrapbook style:
    - Photos appear "taped" to the page
    - Slight rotations and overlaps for realism
    - Random/artistic placement rather than grid
  - Multiple photos per spread

**Navigation Controls**:

- **Next Page**: Click bottom-right corner of right page
- **Previous Page**: Click bottom-left corner of left page
- Continues flipping through photos for the current city

#### Album End (Back Cover)

- When all photos for a city are viewed, user reaches the back cover
- Back cover displays three options:
  1. "Go to Book Cover" - returns to landing page
  2. "Back to Map" - returns to world map
  3. "Restart Album" - goes back to first page of this city's album

---

### 4. Navigation Bookmarks

**Description**: Persistent navigation elements styled as physical bookmarks

**Bookmark Types** (in order):

1. Map bookmark (goes to world map)
2. City Albums bookmark (goes to album section)
3. Statistics bookmark (future feature, goes to statistics chapter)

**Dynamic Positioning**:
Bookmarks change position based on current location to maintain realism:

- **Book Cover (closed book, viewing cover)**:
  - All bookmarks on the right edge
- **Back Cover (closed book, viewing back)**:
  - All bookmarks on the left edge
- **Open Book (e.g., viewing city album)**:
  - Map bookmark on left edge (sections before albums)
  - Statistics bookmark on right edge (sections after albums)
  - City Albums bookmark not visible (currently on this section) OR centered

**Behavior**:

- Always visible and accessible
- Clicking a bookmark navigates to that section
- Appropriate page-turning animation plays during navigation

---

### 5. Statistics Chapter (Future Feature)

**Description**: To be defined later

**Current Requirement**:

- Reserve bookmark space
- Plan navigation structure to accommodate this section
- Position: After albums, before back cover

**Potential Content Ideas** (not to be implemented yet):

- Total countries/states/cities visited
- Travel timeline
- Most visited regions
- Photo counts
- Travel heatmaps

---

## Data Structure Requirements

### Marker Data Object

Each city marker should store:

- **Location**:
  - City name
  - Country
  - State/District (if applicable)
  - Geographic coordinates (latitude, longitude)
- **Status Flags**:
  - Visited (boolean)
  - Favorite (boolean)
  - Want to visit (boolean)
- **User Content**:
  - Notes/description (text)
  - Visit date(s) (date or date range)
  - Companions (text)
  - Activities/sights (text)
  - Photo URLs (array of Cloudinary URLs)
- **Metadata**:
  - Created timestamp
  - Last modified timestamp

### Geographic Data

- Hierarchy structure for countries → states → (optional third level)
- City database with:
  - City names
  - Population data (for sorting)
  - Coordinates
  - Parent region relationships

### Local Storage

- Cache frequently accessed data
- Store user session state
- Persist current view/zoom level
- Remember last selected hierarchy level

---

## User Experience Flow

### Primary User Journey

1. User lands on book cover
2. Clicks cover → page flip animation → arrives at world map
3. Selects hierarchy level (e.g., "States")
4. Chooses display mode (Markers or Area Highlighting)
5. Clicks on a region on the map
6. Searches/selects a city from the list
7. Marks city and adds details/photos
8. Clicks "Save" → marker appears on map
9. Clicks marker → views details
10. Clicks "See Album" → page-turning animation → photo album
11. Flips through album pages
12. Uses bookmarks to navigate to other sections

### Navigation Patterns

- **Forward**: Cover → Map → Albums → (Statistics) → Back Cover
- **Bookmarks**: Jump directly to any major section
- **Back navigation**: Always available through bookmarks or back cover options

---

## Animation Requirements

### Page Flip Animations

- **Trigger Points**:
  - Cover to Map
  - Map to Albums
  - Between album pages
  - Bookmark navigation
  - Back cover navigation

- **Animation Style**:
  - Realistic 3D page curl/flip effect
  - Smooth timing (not too fast or slow)
  - Should feel like turning physical book pages

### Other Animations

- Marker appearance on map (subtle pop-in)
- City list slide-in
- Modal/box fade-in for marker details
- Bookmark hover effects
- Area highlighting transitions (when switching hierarchy levels)

---

## Responsive Design Considerations

### Desktop (Primary Target)

- Full book spread visible
- Two-page layout for albums
- Side-by-side menu and map

### Tablet

- Adapt book spread to narrower screens
- Single page view for albums if needed
- Touch-friendly controls

### Mobile

- Single page always
- Simplified map controls
- Touch gestures for page turning
- Bookmarks accessible via menu icon

---

## External Service Integration

### Cloudinary Setup

- **Purpose**: Store and deliver all photos
- **Requirements**:
  - Create upload preset for frontend uploads
  - Configure transformations for optimal delivery
  - Set up folders/organization for different cities
  - Implement lazy loading for images

### Supabase Setup

- **Purpose**: Store all marker and user data
- **Requirements**:
  - Design database schema for markers, cities, hierarchies
  - Set up API keys and authentication
  - Configure row-level security (if needed)
  - Implement queries for CRUD operations
  - **Cron Job**: Set up automated ping every 2-3 days to keep instance active

### GitHub Pages Deployment

- **Requirements**:
  - Configure Angular build for GitHub Pages
  - Set up custom domain (if desired)
  - Ensure routing works with static hosting
  - Configure environment variables for API keys

---

## Security & Privacy

### Data Protection

- API keys stored in environment variables (not in repository)
- Supabase row-level security to restrict access
- Cloudinary signed uploads if possible
- No sensitive personal data in public code

### Access Control

- Application is public but data is private
- Consider simple authentication for Supabase (even if just shared password)
- Rate limiting on external API calls if possible

---

## Development Phases

### Phase 1: Core Map Interface

- Book cover component
- Basic map display
- Hierarchy selector
- Zone selection and city list
- Basic marker creation and display

### Phase 2: Marker Management

- Detailed marker form (notes, dates, companions)
- Display mode toggle (Markers vs Area Highlighting)
- Area highlighting logic based on hierarchy
- Marker details box with all information

### Phase 3: Photo Integration

- Cloudinary integration
- Photo upload from marker form
- Photo storage and retrieval

### Phase 4: Album Feature

- Page turning animations
- Album page layout with scrapbook styling
- Photo display in albums
- Album navigation (next/previous)
- Back cover with navigation options

### Phase 5: Navigation System

- Bookmark components
- Dynamic bookmark positioning
- Section-to-section navigation
- Complete page flip animations between sections

### Phase 6: Polish & Optimization

- Responsive design
- Performance optimization
- Loading states and error handling
- Cross-browser testing
- Accessibility improvements

### Phase 7: Statistics (Future)

- Define statistics requirements
- Implement statistics chapter
- Add statistics bookmark functionality

---

## Component Architecture

### Angular Components Structure

**Core Components**:

- `book-cover`: Landing page component
- `world-map`: Main map interface
- `map-controls`: Hierarchy selector and display mode toggle
- `map-canvas`: Map rendering and interactions
- `city-list`: Zone cities display and search
- `marker-form`: Add/edit marker details
- `marker-details`: Display marker information box
- `photo-album`: Album page spread display
- `navigation-bookmarks`: Bookmark navigation system
- `page-flip-animation`: Reusable page turning animation

**Shared Components**:

- `book-page`: Base component for page styling
- `button`: Themed button component
- `modal`: Reusable modal/dialog
- `image-uploader`: Photo upload interface

**Services**:

- `marker.service`: Manage marker CRUD operations with Supabase
- `photo.service`: Handle Cloudinary uploads and retrieval
- `map.service`: Geographic data and map state management
- `navigation.service`: Handle routing and section transitions
- `animation.service`: Coordinate page flip animations
- `storage.service`: Local storage management

---

## Design Aesthetics

### Visual Theme

- **Style**: Physical book aesthetic throughout
- **Colors**:
  - Earthy tones for book pages (cream, beige)
  - Blue for water/sea
  - White for land
  - Accent colors for markers (differentiate visited/favorite/want)
- **Typography**:
  - Hand-written style for notes and labels
  - Classic serif for titles and city names
  - Readable sans-serif for UI controls

### Scrapbook Elements

- Photos appear taped or pinned to pages
- Slight shadows and depth for realism
- Vintage/nostalgic feel
- Organic, non-grid layouts

### Interactive Feedback

- Hover effects on clickable elements
- Smooth transitions
- Loading indicators during data fetch
- Success/error notifications for user actions

---

## Mood Board & Design Inspiration

https://benomadpt.com/products/travel-book

https://www.figma.com/design/fbJetSJm9PbxAsOqDnpvG7/Travel-Book?node-id=54198-66&p=f&t=hX0FHvQySuNl1V2Y-0

https://www.youtube.com/watch?v=MNZFmLQBR4I

### Visual References

**Book & Page Aesthetics**:

- Physical book textures and leather binding designs
- Vintage travel journals and diaries
- Coffee table travel books
- Old library aesthetic
- Aged paper textures with warm tones
- Ideas:
  - Search: "vintage travel journal", "leather book cover", "aged paper texture"
  - References: Moleskine journals, vintage atlases, traveler's notebooks

**Page Flip Animations**:

- 3D page turning effects (CSS/Canvas/WebGL)
- E-book reader page transitions
- Digital flipbook animations
- Ideas:
  - Libraries: turn.js, page-flip, StPageFlip
  - Search: "realistic page flip animation", "3D book flip CSS"
  - Inspiration: Apple Books page curl, Flipboard transitions

**Scrapbook & Photo Layouts**:

- Vintage scrapbook pages with taped photos
- Polaroid photo arrangements
- Travel memory boards
- Collage-style layouts with organic placement
- Washi tape and decorative elements
- Ideas:
  - Search: "vintage scrapbook layout", "polaroid photo collage", "travel scrapbook aesthetic"
  - Pinterest boards: travel scrapbooking, vintage photo albums
  - CSS: `transform: rotate()` for photo tilt effects

**Map Design Inspiration**:

- Minimalist world maps (flat design)
- Vintage atlas aesthetics
- Simplified geographic representations
- Interactive map UIs (Google Maps, Mapbox styles)
- Ideas:
  - Map libraries: Leaflet, D3.js, amCharts Maps
  - Search: "minimalist world map", "flat design map", "simple country borders SVG"
  - Color scheme: white land, blue oceans (clean and readable)
  - Consider: Natural Earth datasets for geographic boundaries

### Color Palette Ideas

**Primary Colors**:

- **Book Pages**: `#F5F1E8` (cream), `#E8DCC4` (aged paper), `#D4C5A9` (old parchment)
- **Ocean/Sea**: `#4A90E2` (soft blue), `#5B9BD5` (map blue), `#6BA3D4` (calm water)
- **Land**: `#FFFFFF` (pure white for contrast), `#FAFAF8` (off-white)
- **Text**: `#2C2416` (dark brown), `#3E3428` (warm black)

**Accent Colors**:

- **Visited Marker**: `#8BC34A` (green - been there)
- **Favorite Marker**: `#FF5722` (warm red - loved it)
- **Wishlist Marker**: `#FFC107` (amber - want to go)
- **Borders**: `#B8B8B8` (light gray for country/state lines)

**Inspiration Sources**:

- Vintage map color schemes
- Coffee-stained paper aesthetics
- Earthy, warm tones
- Tools: [Coolors.co](https://coolors.co), [Adobe Color](https://color.adobe.com)

### Typography References

**Font Pairings**:

- **Titles/Headers**: Playfair Display, Crimson Text, Libre Baskerville (elegant serif)
- **Body Text**: Open Sans, Lato, Inter (clean sans-serif for readability)
- **Handwritten Notes**: Indie Flower, Shadows Into Light, Permanent Marker (casual, personal feel)
- **Map Labels**: Roboto, Source Sans Pro (clear and modern)

**Resources**:

- [Google Fonts](https://fonts.google.com) - free web fonts
- Font pairing tools: [FontPair](https://fontpair.co), [Fontjoy](https://fontjoy.com)

### UI/UX Inspiration

**Bookmark Navigation**:

- Physical bookmark designs (ribbons, tabs)
- Side tab navigation examples
- Google Chrome tabs aesthetic
- Sticky navigation patterns

**Interactive Elements**:

- Smooth modal/dialog animations
- Micro-interactions (hover states, button clicks)
- Form design best practices
- Loading skeleton screens

**Reference Sites/Apps**:

- Travel apps: TripAdvisor, Google Travel, Wanderlog
- Photo apps: Instagram, VSCO (for album layouts)
- Map apps: Google Maps (for marker interactions)
- E-readers: Apple Books, Kindle (for page turning)

### Animation References

**Page Transitions**:

- Library examples: GSAP (GreenSock), Anime.js, Framer Motion
- CSS 3D transforms and perspective
- Canvas-based animations for smooth performance
- Ideas:
  - Search: "page flip animation codepen", "book opening animation CSS"
  - Tutorial sites: CSS-Tricks, Codrops

**Marker Animations**:

- Pop-in effects (scale + fade)
- Bounce or elastic easing
- Staggered animations for multiple markers
- Google Maps marker drop animation

**Area Highlighting**:

- SVG morphing and fill transitions
- Gradient overlays
- Color fade-in effects
- Heat map visualizations

### Component Inspiration

**Map Interactions**:

- Zoom and pan controls
- Click-to-select regions
- Tooltip/popup on hover
- References: Mapbox examples, D3 choropleth maps

**City Search/Select**:

- Autocomplete search boxes
- Dropdown with search filter
- List with infinite scroll or pagination
- References: Google Places autocomplete, Select2, Choices.js

**Photo Upload**:

- Drag-and-drop interface
- Preview thumbnails before upload
- Progress indicators
- References: Dropzone.js, FilePond, Uppy

**Modal/Dialog Boxes**:

- Smooth fade-in backgrounds
- Centered content with close button
- Keyboard accessibility (ESC to close)
- References: Modal design patterns on Dribbble, Behance

### Resource Links

**Design Inspiration Platforms**:

- [Dribbble](https://dribbble.com) - Search: "travel app", "map interface", "book UI"
- [Behance](https://behance.net) - Search: "travel journal", "interactive map"
- [Pinterest](https://pinterest.com) - Create boards for travel aesthetics, vintage designs
- [Awwwards](https://awwwards.com) - Premium web design examples

**Code Examples & Tutorials**:

- [CodePen](https://codepen.io) - Search: "page flip", "book animation", "map interaction"
- [Codrops](https://tympanus.net/codrops) - Creative web design experiments
- [CSS-Tricks](https://css-tricks.com) - Tutorials and guides

**Asset Resources**:

- [Unsplash](https://unsplash.com) - Free high-quality photos for mockups
- [Pexels](https://pexels.com) - Free stock photos and textures
- [SVG Maps](https://simplemaps.com) - World map SVG files
- [Natural Earth](https://naturalearthdata.com) - Free geographic datasets

**Animation Libraries**:

- [GSAP](https://greensock.com/gsap) - Professional-grade animation
- [Anime.js](https://animejs.com) - Lightweight animation library
- [Lottie](https://airbnb.io/lottie) - JSON-based animations
- [turn.js](http://www.turnjs.com) - Flipbook jQuery plugin

**Map Libraries**:

- [Leaflet](https://leafletjs.com) - Lightweight interactive maps
- [D3.js](https://d3js.org) - Data-driven documents (custom map visualizations)
- [amCharts Maps](https://amcharts.com/javascript-maps) - Interactive map charts
- [Mapbox GL JS](https://mapbox.com) - Customizable vector maps

### Ideas to Consider

**Additional Design Elements**:

- Subtle page curl shadow on corners (hover effect)
- Coffee stain rings on some pages (decorative)
- Margin notes or doodles for personal touch
- Torn edge effect on photo edges
- Compass rose icon on map
- Vintage stamp graphics for visited markers

**Texture & Details**:

- Canvas noise texture overlay for realism
- Subtle paper grain
- Soft shadows under photos
- Dog-eared page corners
- Bookmark ribbon hanging from top of book

**Interactive Enhancements**:

- Sound effects: page rustle when flipping, gentle click for buttons
- Parallax scrolling on album pages
- Photo zoom/lightbox on click
- Animated marker pins that bounce when clicked
- Map legend explaining marker colors

**Accessibility Considerations**:

- High contrast mode option
- Reduced motion mode (disable page flips for users who prefer)
- Keyboard navigation through bookmarks and pages
- Screen reader friendly labels
- Focus indicators on interactive elements

---

## Performance Considerations

### Optimization Strategies

- Lazy load photos (load when entering album view)
- Cache map data locally
- Debounce search inputs
- Pagination for large city lists
- Image optimization via Cloudinary transformations
- Minimize bundle size (tree shaking, lazy loaded routes)

### Loading States

- Skeleton screens for map loading
- Spinner for page transitions
- Progress indicators for photo uploads
- Optimistic UI updates where possible

---

## Future Enhancements (Not Current Scope)

- Statistics chapter implementation
- Multi-user support (friends/family sharing albums)
- Export functionality (PDF album, travel summary)
- Social sharing features
- Trip planning mode
- Travel recommendations based on wishlisted places
- Integration with travel APIs for city information
- Dark mode

---

## Success Criteria

The project will be considered complete when:

1. ✅ User can navigate through all book sections with smooth animations
2. ✅ User can add markers to cities with full details
3. ✅ User can upload and view photos in scrapbook-style albums
4. ✅ Map displays hierarchy levels correctly
5. ✅ Area highlighting mode works for all hierarchy levels
6. ✅ Bookmarks provide intuitive navigation
7. ✅ Application is deployed and accessible via GitHub Pages
8. ✅ Data persists correctly in Supabase
9. ✅ Photos load efficiently from Cloudinary
10. ✅ Application works smoothly on desktop and tablet devices

---

## Notes for Developers

- This is a passion project, prioritize user experience and aesthetics
- The book metaphor should feel cohesive throughout
- Animations are crucial for the "magic" of the experience
- Keep the interface intuitive - minimal learning curve
- Performance matters: page flips and transitions must be smooth
- Plan component structure before implementation
- Consider animation library (e.g., GSAP) for complex page flips
- Test thoroughly with real photo uploads
- Keep code modular and maintainable for future enhancements

---

**Last Updated**: February 14, 2026
**Status**: Specification Complete - Ready for Development
