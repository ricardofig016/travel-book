-- Travel Book Database Schema
-- Supabase PostgreSQL Schema

-- Enable PostGIS extension for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- COUNTRIES TABLE
-- =====================================================
CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  iso_code_2 VARCHAR(2) NOT NULL UNIQUE, -- ISO 3166-1 alpha-2
  iso_code_3 VARCHAR(3) NOT NULL UNIQUE, -- ISO 3166-1 alpha-3
  geometry JSONB, -- GeoJSON for country boundaries (simplified for performance)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster country lookups
CREATE INDEX idx_countries_name ON countries(name);
CREATE INDEX idx_countries_iso2 ON countries(iso_code_2);

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
  admin_name TEXT, -- Highest level admin region (state/province) - for future scalability
  population INTEGER, -- Urban population estimate (may be null for smaller cities)
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure city names are unique per country
  CONSTRAINT unique_city_per_country UNIQUE(name, country_id)
);

-- Indexes for performance
CREATE INDEX idx_cities_country ON cities(country_id);
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_home_city ON user_profiles(home_city_id);

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
-- USER TRIED DISHES TABLE
-- =====================================================
CREATE TABLE user_tried_dishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one entry per user per dish
  CONSTRAINT unique_user_dish UNIQUE(user_id, dish_id)
);

-- Indexes for performance
CREATE INDEX idx_user_tried_dishes_user ON user_tried_dishes(user_id);
CREATE INDEX idx_user_tried_dishes_dish ON user_tried_dishes(dish_id);

-- =====================================================
-- MARKERS TABLE
-- =====================================================
CREATE TABLE markers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User identification (will be linked to auth.users in RLS)
  user_id UUID NOT NULL,
  
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
  
  -- Ensure one marker per city per user
  CONSTRAINT unique_marker_per_user_city UNIQUE(user_id, city_id)
);

-- Indexes for performance
CREATE INDEX idx_markers_user ON markers(user_id);
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
  date DATE, -- When the photo was taken
  caption TEXT, -- User's caption for the photo
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_photos_marker ON photos(marker_id);
CREATE INDEX idx_photos_date ON photos(date DESC NULLS LAST);
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

CREATE TRIGGER update_user_tried_dishes_updated_at
  BEFORE UPDATE ON user_tried_dishes
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
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tried_dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marker_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Countries: Public read access
CREATE POLICY "Countries are viewable by everyone"
  ON countries FOR SELECT
  USING (true);

-- Countries: Admin only write access (for seeding/maintenance)
CREATE POLICY "Countries are editable by admins only"
  ON countries FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Cities: Public read access
CREATE POLICY "Cities are viewable by everyone"
  ON cities FOR SELECT
  USING (true);

-- Cities: Admin only write access (for seeding/maintenance)
CREATE POLICY "Cities are editable by admins only"
  ON cities FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Dishes: Public read access
CREATE POLICY "Dishes are viewable by everyone"
  ON dishes FOR SELECT
  USING (true);

-- Dishes: Admin only write access (for seeding/maintenance)
CREATE POLICY "Dishes are editable by admins only"
  ON dishes FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

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

-- User Tried Dishes: Users can view their own tried dishes
CREATE POLICY "Users can view their own tried dishes"
  ON user_tried_dishes FOR SELECT
  USING (auth.uid() = user_id);

-- User Tried Dishes: Users can insert their own tried dishes
CREATE POLICY "Users can insert their own tried dishes"
  ON user_tried_dishes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User Tried Dishes: Users can delete their own tried dishes
CREATE POLICY "Users can delete their own tried dishes"
  ON user_tried_dishes FOR DELETE
  USING (auth.uid() = user_id);

-- Markers: Users can only see their own markers
CREATE POLICY "Users can view their own markers"
  ON markers FOR SELECT
  USING (auth.uid() = user_id);

-- Markers: Users can insert their own markers
CREATE POLICY "Users can insert their own markers"
  ON markers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Markers: Users can update their own markers
CREATE POLICY "Users can update their own markers"
  ON markers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Markers: Users can delete their own markers
CREATE POLICY "Users can delete their own markers"
  ON markers FOR DELETE
  USING (auth.uid() = user_id);

-- Marker Visits: Users can view visits from their own markers
CREATE POLICY "Users can view visits from their own markers"
  ON marker_visits FOR SELECT
  USING (
    marker_id IN (
      SELECT id FROM markers WHERE user_id = auth.uid()
    )
  );

-- Marker Visits: Users can insert visits to their own markers
CREATE POLICY "Users can insert visits to their own markers"
  ON marker_visits FOR INSERT
  WITH CHECK (
    marker_id IN (
      SELECT id FROM markers WHERE user_id = auth.uid()
    )
  );

-- Marker Visits: Users can update visits from their own markers
CREATE POLICY "Users can update visits from their own markers"
  ON marker_visits FOR UPDATE
  USING (
    marker_id IN (
      SELECT id FROM markers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    marker_id IN (
      SELECT id FROM markers WHERE user_id = auth.uid()
    )
  );

-- Marker Visits: Users can delete visits from their own markers
CREATE POLICY "Users can delete visits from their own markers"
  ON marker_visits FOR DELETE
  USING (
    marker_id IN (
      SELECT id FROM markers WHERE user_id = auth.uid()
    )
  );

-- Photos: Users can only see photos from their own markers
CREATE POLICY "Users can view photos from their own markers"
  ON photos FOR SELECT
  USING (
    marker_id IN (
      SELECT id FROM markers WHERE user_id = auth.uid()
    )
  );

-- Photos: Users can insert photos to their own markers
CREATE POLICY "Users can insert photos to their own markers"
  ON photos FOR INSERT
  WITH CHECK (
    marker_id IN (
      SELECT id FROM markers WHERE user_id = auth.uid()
    )
  );

-- Photos: Users can update photos from their own markers
CREATE POLICY "Users can update photos from their own markers"
  ON photos FOR UPDATE
  USING (
    marker_id IN (
      SELECT id FROM markers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    marker_id IN (
      SELECT id FROM markers WHERE user_id = auth.uid()
    )
  );

-- Photos: Users can delete photos from their own markers
CREATE POLICY "Users can delete photos from their own markers"
  ON photos FOR DELETE
  USING (
    marker_id IN (
      SELECT id FROM markers WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- VIEWS
-- =====================================================

-- View for marker statistics by country
CREATE OR REPLACE VIEW marker_stats_by_country AS
SELECT 
  c.id AS country_id,
  c.name AS country_name,
  c.iso_code_2,
  m.user_id,
  COUNT(*) AS total_markers,
  COUNT(*) FILTER (WHERE m.visited) AS visited_count,
  COUNT(*) FILTER (WHERE m.favorite) AS favorite_count,
  COUNT(*) FILTER (WHERE m.want) AS wishlist_count
FROM countries c
INNER JOIN cities ci ON c.id = ci.country_id
INNER JOIN markers m ON ci.id = m.city_id
GROUP BY c.id, c.name, c.iso_code_2, m.user_id;

-- Apply RLS to view
ALTER VIEW marker_stats_by_country SET (security_barrier = true);

-- Grant access to authenticated users
GRANT SELECT ON marker_stats_by_country TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE countries IS 'Geographic country data with boundaries';
COMMENT ON TABLE cities IS 'Cities from SimpleMaps worldcities.csv (~48k entries) with population and coordinates';
COMMENT ON TABLE user_profiles IS 'User profile data including home city and future preferences';
COMMENT ON TABLE dishes IS 'Signature dishes per country from TasteAtlas dataset';
COMMENT ON TABLE user_tried_dishes IS 'Tracks which dishes each user has tried';
COMMENT ON TABLE markers IS 'User travel markers with status, content, and metadata';
COMMENT ON TABLE marker_visits IS 'Visit periods (start and end dates) for each marker';
COMMENT ON TABLE photos IS 'Photos uploaded by users for their travel markers with Cloudinary metadata';

COMMENT ON COLUMN cities.simplemaps_id IS 'SimpleMaps 10-digit unique ID for data consistency across updates';
COMMENT ON COLUMN cities.name IS 'Unicode city name (e.g. Goiânia)';
COMMENT ON COLUMN cities.name_ascii IS 'ASCII representation for search and sorting (e.g. Goiania)';
COMMENT ON COLUMN cities.admin_name IS 'Highest level admin region (state/province) - retained for future scalability beyond country-level MVP';
COMMENT ON COLUMN cities.population IS 'Urban population estimate (may be null for smaller cities)';
COMMENT ON COLUMN user_profiles.home_city_id IS 'Reference to user home city (can be null if not set)';
COMMENT ON COLUMN user_tried_dishes.user_id IS 'User who tried the dish';
COMMENT ON COLUMN user_tried_dishes.dish_id IS 'Dish that was tried';
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
COMMENT ON COLUMN photos.uploaded_at IS 'Timestamp when the photo was uploaded to Cloudinary';
COMMENT ON COLUMN marker_visits.marker_id IS 'Marker this visit belongs to';
COMMENT ON COLUMN marker_visits.start_date IS 'Start date of the visit period';
COMMENT ON COLUMN marker_visits.end_date IS 'End date of the visit period';
COMMENT ON COLUMN markers.companions IS 'Array of companion names/descriptions';
COMMENT ON COLUMN markers.activities IS 'Array of activities done at this location';
COMMENT ON COLUMN markers.photo_urls IS 'Array of Cloudinary photo URLs';
