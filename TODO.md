# TODO

- [ ] test: add supabase tests of authenticated, non-admin users
- [ ] data: setup cloudinary
- [ ] data: seed cloudinary with demo photos for the demo book
- [ ] map: add border countries to hovered country metadata block. on hover of each country on that list, that country gets highlighted and all other highlights get disabled
- [ ] map: on hover of a country, draw a dot on the capital city coords
- [ ] fix: country hover metadata takes too long to load
- [ ] map: add a script to run on the transformed geojson data (public/assets/data/geo/visvalingam-weighted_1.8pct_keepshapes_clean.geojson) to remove countries not included in the db (Northern Cyprus, Baykonur Cosmodrome) and normalize countries with missing iso codes (France, Norway)
- [ ] refactor: world map component is getting too big
- [ ] refactor: supabase service is getting too big
- [x] map: change highlight color on home country to a less blueish green, since the blue highlight is used for hovered countries and can create confusion
- [x] fix: 404 on gh pages website when accessing non-root routes (e.g. /account) directly
- [x] map: sync map zoom constants in world-map.component.ts and constants.ts
- [x] map: zoom should be centered on the cursor position, not the center of the screen
- [x] data: seed countries table with GeoJSON boundaries
- [x] map: choose geojson transformation
- [x] data: create the gh action for the supabase keepalive ping
- [x] chore: rename albums/ route to album/
- [x] schema: make sure the user can leave/hide the demo book if they want to
