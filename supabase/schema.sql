-- Travel Book Database Schema
-- Supabase PostgreSQL Schema

-- Enable PostGIS extension for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- BOOKS TABLE
-- =====================================================
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false, -- Reserved for the single seeded demo/showcase book only
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, -- Track creator for initial member setup
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_books_is_public ON books(is_public);

-- Enforce exactly one public/demo book at most
CREATE UNIQUE INDEX idx_books_single_public_book
  ON books(is_public)
  WHERE is_public = true;

-- =====================================================
-- BOOK MEMBERS TABLE
-- =====================================================
CREATE TABLE book_members (
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite primary key: one membership per user per book
  PRIMARY KEY (book_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_book_members_user ON book_members(user_id);
CREATE INDEX idx_book_members_book ON book_members(book_id);

-- =====================================================
-- COUNTRIES TABLE
-- =====================================================
CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- Common country name (e.g., Japan)
  native_name TEXT, -- Native common name (e.g., 日本 for Japan)
  iso_code_2 VARCHAR(2) NOT NULL UNIQUE, -- ISO 3166-1 alpha-2 (e.g., JP)
  iso_code_3 VARCHAR(3) NOT NULL UNIQUE, -- ISO 3166-1 alpha-3 (e.g., JPN)
  
  -- Geographic and demographic data
  area NUMERIC(15, 2), -- Land area in km²
  population BIGINT, -- Country population
  latitude DECIMAL(10, 8), -- Country center latitude
  longitude DECIMAL(11, 8), -- Country center longitude
  landlocked BOOLEAN, -- Whether the country is landlocked
  borders TEXT[], -- Array of bordering country ISO codes (e.g., ["BLZ", "GTM", "USA" for Mexico)
  
  -- Regional classification
  continents TEXT[], -- Continents the country is on (e.g., ['Asia'])
  subregion TEXT, -- UN demographic subregion (e.g., 'Eastern Asia')
  
  -- Contact and communication
  calling_codes TEXT[], -- International dialing codes (e.g., ['+81'] for Japan)
  languages TEXT[], -- Official languages (e.g., ['Japanese'])
  timezones TEXT[], -- Timezone identifiers (e.g., ['UTC+09:00'])
  
  -- Transportation
  car_signs TEXT[], -- Car distinguishing signs (e.g., ['J'] for Japan)
  car_side TEXT, -- Driving side: 'left' or 'right'
  
  -- Links and resources
  google_maps_url TEXT, -- Link to Google Maps
  
  -- Imagery
  geometry JSONB, -- GeoJSON for country boundaries (simplified for performance)
  coat_of_arms_svg TEXT, -- URL to coat of arms SVG image
  coat_of_arms_png TEXT, -- URL to coat of arms PNG image
  flag_emoji TEXT, -- Flag emoji (e.g., 🇯🇵)
  flag_svg TEXT, -- URL to flag SVG image
  flag_png TEXT, -- URL to flag PNG image
  flag_alt TEXT, -- Flag description for accessibility
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster country lookups
CREATE INDEX idx_countries_name ON countries(name);
CREATE INDEX idx_countries_iso2 ON countries(iso_code_2);
CREATE INDEX idx_countries_iso3 ON countries(iso_code_3);
CREATE INDEX idx_countries_subregion ON countries(subregion);

-- =====================================================
-- CURRENCIES TABLE
-- =====================================================
CREATE TABLE currencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  code VARCHAR(3) NOT NULL, -- ISO 4217 currency code (e.g., JPY)
  symbol TEXT, -- Currency symbol (e.g., ¥)
  name TEXT NOT NULL, -- Currency name (e.g., Japanese yen)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one entry per country per currency
  CONSTRAINT unique_country_currency UNIQUE(country_id, code)
);

-- Indexes for performance
CREATE INDEX idx_currencies_country ON currencies(country_id);
CREATE INDEX idx_currencies_code ON currencies(code);

-- =====================================================
-- CITIES TABLE
-- =====================================================
-- Based on SimpleMaps worldcities.csv (~48k cities)
CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  simplemaps_id VARCHAR(10) NOT NULL UNIQUE, -- SimpleMaps 10-digit unique ID
  name TEXT NOT NULL, -- Unicode city name (e.g. Goiânia)
  name_ascii TEXT, -- ASCII representation for search/sorting (e.g. Goiania)
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  is_capital BOOLEAN NOT NULL DEFAULT false, -- Whether this city is the country's capital
  admin_name TEXT, -- Highest level admin region (state/province) - for future scalability
  population INTEGER, -- Urban population estimate (may be null for smaller cities)
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cities_country ON cities(country_id);
CREATE INDEX idx_cities_country_capital ON cities(country_id, is_capital);
CREATE INDEX idx_cities_admin ON cities(admin_name); -- For state/province filtering
CREATE INDEX idx_cities_population ON cities(population DESC NULLS LAST);
CREATE INDEX idx_cities_name ON cities(name);
CREATE INDEX idx_cities_name_ascii ON cities(name_ascii); -- For ASCII-based search
CREATE INDEX idx_cities_simplemaps_id ON cities(simplemaps_id);
CREATE INDEX idx_cities_coordinates ON cities(latitude, longitude);

-- =====================================================
-- USER PROFILES TABLE
-- =====================================================
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  home_city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  hide_demo_book BOOLEAN DEFAULT false, -- User preference to hide the public demo book from their book list
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_home_city ON user_profiles(home_city_id);

-- =====================================================
-- ADMIN USERS TABLE
-- =====================================================
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_admin_users_user ON admin_users(user_id);

-- =====================================================
-- DISHES TABLE
-- =====================================================
CREATE TABLE dishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Dish name (e.g. Manti)
  category TEXT, -- Dish category (e.g. Dumplings, Bread, Stew)
  location TEXT, -- Specific region/area (e.g. Belém, Portugal)
  tasteatlas_url TEXT, -- Link to TasteAtlas page
  image_url TEXT, -- URL to dish image
  rating DECIMAL(3, 1), -- Rating from TasteAtlas (e.g. 4.3)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure dish names are unique per country
  CONSTRAINT unique_dish_per_country UNIQUE(name, country_id)
);

-- Indexes for performance
CREATE INDEX idx_dishes_country ON dishes(country_id);
CREATE INDEX idx_dishes_name ON dishes(name);
CREATE INDEX idx_dishes_category ON dishes(category);
CREATE INDEX idx_dishes_location ON dishes(location);
CREATE INDEX idx_dishes_rating ON dishes(rating DESC NULLS LAST);

-- =====================================================
-- BOOK TRIED DISHES TABLE
-- =====================================================
CREATE TABLE book_tried_dishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one entry per book per dish
  CONSTRAINT unique_book_dish UNIQUE(book_id, dish_id)
);

-- Indexes for performance
CREATE INDEX idx_book_tried_dishes_book ON book_tried_dishes(book_id);
CREATE INDEX idx_book_tried_dishes_dish ON book_tried_dishes(dish_id);

-- =====================================================
-- MARKERS TABLE
-- =====================================================
CREATE TABLE markers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Book identification (all members of book can see/edit this marker)
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  
  -- Location data
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  
  -- Status flags
  visited BOOLEAN DEFAULT false,
  favorite BOOLEAN DEFAULT false,
  want BOOLEAN DEFAULT false,
  
  -- Content
  notes TEXT,
  companions TEXT[],
  activities TEXT[],
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one marker per city per book
  CONSTRAINT unique_marker_per_book_city UNIQUE(book_id, city_id)
);

-- Indexes for performance
CREATE INDEX idx_markers_book ON markers(book_id);
CREATE INDEX idx_markers_city ON markers(city_id);
CREATE INDEX idx_markers_status ON markers(visited, favorite, want);
CREATE INDEX idx_markers_created ON markers(created_at DESC);

-- =====================================================
-- MARKER VISITS TABLE
-- =====================================================
CREATE TABLE marker_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marker_id UUID NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure end date is not before start date
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Indexes for performance
CREATE INDEX idx_marker_visits_marker ON marker_visits(marker_id);
CREATE INDEX idx_marker_visits_start_date ON marker_visits(start_date DESC);
CREATE INDEX idx_marker_visits_end_date ON marker_visits(end_date DESC);

-- =====================================================
-- PHOTOS TABLE
-- =====================================================
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marker_id UUID NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
  
  -- Cloudinary metadata
  url TEXT NOT NULL, -- Cloudinary CDN URL
  public_id TEXT NOT NULL, -- Cloudinary public ID for management (delete, update)
  
  -- Photo metadata
  date_taken DATE, -- When the photo was taken
  caption TEXT, -- User's caption for the photo
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_photos_marker ON photos(marker_id);
CREATE INDEX idx_photos_date_taken ON photos(date_taken DESC NULLS LAST);
CREATE INDEX idx_photos_public_id ON photos(public_id); -- For Cloudinary operations

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create user profile when added to a book
CREATE OR REPLACE FUNCTION create_user_profile_on_book_member_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a user profile if it doesn't already exist
  INSERT INTO user_profiles (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a user is an admin (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION is_admin(user_uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = user_uid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile on book membership
CREATE TRIGGER create_user_profile_on_book_member_insert
  AFTER INSERT ON book_members
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_on_book_member_insert();

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_countries_updated_at
  BEFORE UPDATE ON countries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cities_updated_at
  BEFORE UPDATE ON cities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dishes_updated_at
  BEFORE UPDATE ON dishes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_currencies_updated_at
  BEFORE UPDATE ON currencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_book_tried_dishes_updated_at
  BEFORE UPDATE ON book_tried_dishes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_markers_updated_at
  BEFORE UPDATE ON markers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marker_visits_updated_at
  BEFORE UPDATE ON marker_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_photos_updated_at
  BEFORE UPDATE ON photos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_tried_dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marker_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Books: The single public demo book is viewable by everyone; private books only by members
CREATE POLICY "Books are viewable by members or single demo public book"
  ON books FOR SELECT
  USING (
    is_public = true
    OR id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
  );

-- Books: Only members can update their own books
CREATE POLICY "Book members can update their books"
  ON books FOR UPDATE
  USING (id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid()))
  WITH CHECK (id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid()));

-- Books: Authenticated users can create private books (created_by must be the current user)
CREATE POLICY "Authenticated users can insert private books"
  ON books FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND is_public = false
    AND created_by = auth.uid()
  );

-- Book Members: Users can view only their own memberships
CREATE POLICY "Users can view their own memberships"
  ON book_members FOR SELECT
  USING (user_id = auth.uid());

-- Book Members: Authenticated users can be added as book members
-- Only the book creator can add members (during book creation)
CREATE POLICY "Book creator can add members at creation"
  ON book_members FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT created_by FROM books WHERE id = book_id
    )
  );

-- Book Members: Users can remove themselves from books
CREATE POLICY "Users can remove themselves from books"
  ON book_members FOR DELETE
  USING (user_id = auth.uid());

-- Book Members: Users cannot modify existing memberships (user_id and book_id are immutable)
CREATE POLICY "Book members cannot be updated"
  ON book_members FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- Countries: Public read access
CREATE POLICY "Countries are viewable by everyone"
  ON countries FOR SELECT
  USING (true);

-- Countries: Admin only write access (for seeding/maintenance)
CREATE POLICY "Countries are editable by admins only"
  ON countries FOR ALL
  USING (is_admin(auth.uid()));

-- Cities: Public read access
CREATE POLICY "Cities are viewable by everyone"
  ON cities FOR SELECT
  USING (true);

-- Cities: Admin only write access (for seeding/maintenance)
CREATE POLICY "Cities are editable by admins only"
  ON cities FOR ALL
  USING (is_admin(auth.uid()));

-- Dishes: Public read access
CREATE POLICY "Dishes are viewable by everyone"
  ON dishes FOR SELECT
  USING (true);

-- Dishes: Admin only write access (for seeding/maintenance)
CREATE POLICY "Dishes are editable by admins only"
  ON dishes FOR ALL
  USING (is_admin(auth.uid()));

-- Currencies: Public read access
CREATE POLICY "Currencies are viewable by everyone"
  ON currencies FOR SELECT
  USING (true);

-- Currencies: Admin only write access (for seeding/maintenance)
CREATE POLICY "Currencies are editable by admins only"
  ON currencies FOR ALL
  USING (is_admin(auth.uid()));

-- User Profiles: Users can only see their own profile
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- User Profiles: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User Profiles: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin Users: Only admins can read the admin users table
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  USING (is_admin(auth.uid()));

-- Admin Users: Admin users can manage admin users
CREATE POLICY "Admin users can manage admin users"
  ON admin_users FOR ALL
  USING (is_admin(auth.uid()));

-- Book Tried Dishes: Users can view tried dishes from books they're a member of
CREATE POLICY "Users can view tried dishes in their books"
  ON book_tried_dishes FOR SELECT
  USING (
    book_id IN (
      SELECT book_id FROM book_members WHERE user_id = auth.uid()
    )
    OR book_id IN (SELECT id FROM books WHERE is_public = true)
  );

-- Book Tried Dishes: Users can insert tried dishes in books they're a member of
CREATE POLICY "Users can insert tried dishes in their books"
  ON book_tried_dishes FOR INSERT
  WITH CHECK (
    book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
  );

-- Book Tried Dishes: Users can delete tried dishes from books they're a member of
CREATE POLICY "Users can delete tried dishes in their books"
  ON book_tried_dishes FOR DELETE
  USING (
    book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
  );

-- Markers: Users can see markers from books they're in or public demo books
CREATE POLICY "Users can view markers in their books"
  ON markers FOR SELECT
  USING (
    book_id IN (
      SELECT book_id FROM book_members WHERE user_id = auth.uid()
    )
    OR book_id IN (SELECT id FROM books WHERE is_public = true)
  );

-- Markers: Users can insert markers in books they're members of
CREATE POLICY "Users can insert markers in their books"
  ON markers FOR INSERT
  WITH CHECK (
    book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
  );

-- Markers: Users can update markers in books they're members of
CREATE POLICY "Users can update markers in their books"
  ON markers FOR UPDATE
  USING (
    book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
  );

-- Markers: Users can delete markers in books they're members of
CREATE POLICY "Users can delete markers in their books"
  ON markers FOR DELETE
  USING (
    book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
  );

-- Marker Visits: Users can view visits from markers in their books
CREATE POLICY "Users can view visits from markers in their books"
  ON marker_visits FOR SELECT
  USING (
    marker_id IN (
      SELECT m.id FROM markers m
      WHERE m.book_id IN (
        SELECT book_id FROM book_members WHERE user_id = auth.uid()
      )
      OR m.book_id IN (SELECT id FROM books WHERE is_public = true)
    )
  );

-- Marker Visits: Users can insert visits to markers in their books
CREATE POLICY "Users can insert visits to markers in their books"
  ON marker_visits FOR INSERT
  WITH CHECK (
    marker_id IN (
      SELECT m.id FROM markers m
      WHERE m.book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
    )
  );

-- Marker Visits: Users can update visits to markers in their books
CREATE POLICY "Users can update visits to markers in their books"
  ON marker_visits FOR UPDATE
  USING (
    marker_id IN (
      SELECT m.id FROM markers m
      WHERE m.book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    marker_id IN (
      SELECT m.id FROM markers m
      WHERE m.book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
    )
  );

-- Marker Visits: Users can delete visits from markers in their books
CREATE POLICY "Users can delete visits from markers in their books"
  ON marker_visits FOR DELETE
  USING (
    marker_id IN (
      SELECT m.id FROM markers m
      WHERE m.book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
    )
  );

-- Photos: Users can view photos from markers in their books
CREATE POLICY "Users can view photos from markers in their books"
  ON photos FOR SELECT
  USING (
    marker_id IN (
      SELECT m.id FROM markers m
      WHERE m.book_id IN (
        SELECT book_id FROM book_members WHERE user_id = auth.uid()
      )
      OR m.book_id IN (SELECT id FROM books WHERE is_public = true)
    )
  );

-- Photos: Users can insert photos to markers in their books
CREATE POLICY "Users can insert photos to markers in their books"
  ON photos FOR INSERT
  WITH CHECK (
    marker_id IN (
      SELECT m.id FROM markers m
      WHERE m.book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
    )
  );

-- Photos: Users can update photos from markers in their books
CREATE POLICY "Users can update photos from markers in their books"
  ON photos FOR UPDATE
  USING (
    marker_id IN (
      SELECT m.id FROM markers m
      WHERE m.book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    marker_id IN (
      SELECT m.id FROM markers m
      WHERE m.book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
    )
  );

-- Photos: Users can delete photos from markers in their books
CREATE POLICY "Users can delete photos from markers in their books"
  ON photos FOR DELETE
  USING (
    marker_id IN (
      SELECT m.id FROM markers m
      WHERE m.book_id IN (SELECT book_id FROM book_members WHERE user_id = auth.uid())
    )
  );

-- =====================================================
-- VIEWS
-- =====================================================

-- View for marker statistics by country and book
CREATE OR REPLACE VIEW marker_stats_by_country WITH (security_invoker) AS
SELECT 
  c.id AS country_id,
  c.name AS country_name,
  c.iso_code_2,
  m.book_id,
  COUNT(*) AS total_markers,
  COUNT(*) FILTER (WHERE m.visited) AS visited_count,
  COUNT(*) FILTER (WHERE m.favorite) AS favorite_count,
  COUNT(*) FILTER (WHERE m.want) AS wishlist_count
FROM countries c
INNER JOIN cities ci ON c.id = ci.country_id
INNER JOIN markers m ON ci.id = m.city_id
GROUP BY c.id, c.name, c.iso_code_2, m.book_id;

-- Apply security barrier for safe predicate handling
ALTER VIEW marker_stats_by_country SET (security_barrier = true);

-- Grant access to authenticated users
GRANT SELECT ON marker_stats_by_country TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE books IS 'Travel books: containers for shared travel data';
COMMENT ON TABLE book_members IS 'Book membership: links users to books they collaborate on';
COMMENT ON TABLE countries IS 'Geographic country data with boundaries, demographics, and contact information';
COMMENT ON TABLE currencies IS 'Currency data for each country with ISO 4217 codes and symbols';
COMMENT ON TABLE cities IS 'Cities from SimpleMaps worldcities.csv (~48k entries) with population and coordinates';
COMMENT ON TABLE user_profiles IS 'User profile data including home city and future preferences';
COMMENT ON TABLE admin_users IS 'Admin user access control for seeding and maintaining reference data';
COMMENT ON TABLE dishes IS 'Signature dishes per country from TasteAtlas dataset';
COMMENT ON TABLE book_tried_dishes IS 'Tracks which dishes have been tried by members of a book';
COMMENT ON TABLE markers IS 'Travel markers belonging to a book with status, content, and metadata';
COMMENT ON TABLE marker_visits IS 'Visit periods (start and end dates) for each marker';
COMMENT ON TABLE photos IS 'Photos uploaded for markers in travel books with Cloudinary metadata';

COMMENT ON COLUMN cities.simplemaps_id IS 'SimpleMaps 10-digit unique ID for data consistency across updates';
COMMENT ON COLUMN cities.name IS 'Unicode city name (e.g. Goiânia)';
COMMENT ON COLUMN cities.name_ascii IS 'ASCII representation for search and sorting (e.g. Goiania)';
COMMENT ON COLUMN cities.admin_name IS 'Highest level admin region (state/province) - retained for future scalability beyond country-level MVP';
COMMENT ON COLUMN cities.population IS 'Urban population estimate (may be null for smaller cities)';
COMMENT ON COLUMN countries.name IS 'Common country name in English (e.g., Japan)';
COMMENT ON COLUMN countries.native_name IS 'Native common country name (e.g., 日本 for Japan)';
COMMENT ON COLUMN cities.is_capital IS 'Whether this city is the country capital';
COMMENT ON COLUMN countries.area IS 'Country area in km²';
COMMENT ON COLUMN countries.population IS 'Total country population';
COMMENT ON COLUMN countries.latitude IS 'Country center latitude';
COMMENT ON COLUMN countries.longitude IS 'Country center longitude';
COMMENT ON COLUMN countries.landlocked IS 'Whether the country is landlocked';
COMMENT ON COLUMN countries.borders IS 'Array of bordering country ISO codes';
COMMENT ON COLUMN countries.continents IS 'Continents the country is on (e.g., [''Asia''])';
COMMENT ON COLUMN countries.subregion IS 'UN demographic subregion (e.g., Eastern Asia)';
COMMENT ON COLUMN countries.calling_codes IS 'International dialing codes (e.g., [''+81''] for Japan)';
COMMENT ON COLUMN countries.languages IS 'Official/common language names (e.g., [''Japanese''])';
COMMENT ON COLUMN countries.timezones IS 'Timezone identifiers (e.g., [''UTC+09:00''])';
COMMENT ON COLUMN countries.car_signs IS 'Car distinguishing signs (e.g., [''J''] for Japan)';
COMMENT ON COLUMN countries.car_side IS 'Driving side: left or right';
COMMENT ON COLUMN countries.google_maps_url IS 'Link to Google Maps for the country';
COMMENT ON COLUMN countries.coat_of_arms_svg IS 'URL to coat of arms SVG image';
COMMENT ON COLUMN countries.coat_of_arms_png IS 'URL to coat of arms PNG image';
COMMENT ON COLUMN countries.flag_emoji IS 'Flag emoji representation (e.g., 🇯🇵)';
COMMENT ON COLUMN countries.flag_svg IS 'URL to flag SVG image';
COMMENT ON COLUMN countries.flag_png IS 'URL to flag PNG image';
COMMENT ON COLUMN countries.flag_alt IS 'Flag description for accessibility';
COMMENT ON COLUMN currencies.country_id IS 'Reference to the country';
COMMENT ON COLUMN currencies.code IS 'ISO 4217 currency code (e.g., JPY)';
COMMENT ON COLUMN currencies.symbol IS 'Currency symbol (e.g., ¥)';
COMMENT ON COLUMN currencies.name IS 'Currency name (e.g., Japanese yen)';
COMMENT ON COLUMN user_profiles.home_city_id IS 'Reference to user home city (can be null if not set)';
COMMENT ON COLUMN user_profiles.hide_demo_book IS 'User preference to hide the public demo book from their personal book list (does not affect non-authenticated users)';
COMMENT ON COLUMN book_tried_dishes.book_id IS 'Book whose members tried the dish';
COMMENT ON COLUMN book_tried_dishes.dish_id IS 'Dish that was tried';
COMMENT ON COLUMN dishes.country_id IS 'Reference to country where dish originates';
COMMENT ON COLUMN dishes.name IS 'Dish name (e.g. Manti, Kabuli Palaw)';
COMMENT ON COLUMN dishes.category IS 'Dish category (e.g. Dumplings, Rice, Bread, Stew)';
COMMENT ON COLUMN dishes.location IS 'Specific region/area of origin (e.g. Naples, Italy or Belém, Portugal)';
COMMENT ON COLUMN dishes.tasteatlas_url IS 'TasteAtlas page URL for the dish';
COMMENT ON COLUMN dishes.image_url IS 'CDN image URL of the dish';
COMMENT ON COLUMN dishes.rating IS 'TasteAtlas rating (0-5 scale)';
COMMENT ON COLUMN photos.marker_id IS 'Reference to the marker this photo belongs to';
COMMENT ON COLUMN photos.url IS 'Cloudinary CDN URL for the photo';
COMMENT ON COLUMN photos.public_id IS 'Cloudinary public ID for photo management (delete, update, transformations)';
COMMENT ON COLUMN photos.date_taken IS 'Date when the photo was taken (user-provided)';
COMMENT ON COLUMN photos.caption IS 'User-provided caption or description for the photo';
COMMENT ON COLUMN marker_visits.marker_id IS 'Marker this visit belongs to';
COMMENT ON COLUMN marker_visits.start_date IS 'Start date of the visit period';
COMMENT ON COLUMN marker_visits.end_date IS 'End date of the visit period';
COMMENT ON COLUMN markers.book_id IS 'Book this marker belongs to';
COMMENT ON COLUMN markers.companions IS 'Array of companion names/descriptions';
COMMENT ON COLUMN markers.activities IS 'Array of activities done at this location';
COMMENT ON COLUMN books.is_public IS 'Reserved flag for the single seeded demo/showcase book visible to all (including non-authenticated users); not a user share-link flag';
COMMENT ON COLUMN books.created_by IS 'User who created the book; used for RLS to allow creator to set initial members during book creation';
COMMENT ON COLUMN book_members.book_id IS 'Reference to the book';
COMMENT ON COLUMN book_members.user_id IS 'User who is a member of the book';
