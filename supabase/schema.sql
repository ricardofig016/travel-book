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
  visit_dates JSONB DEFAULT '[]'::JSONB, -- Array of visit periods: [{start: "2024-01-15", end: "2024-01-20"}, ...]
  companions TEXT[],
  activities TEXT[],
  photo_urls TEXT[] DEFAULT '{}'::TEXT[],
  
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

CREATE TRIGGER update_markers_updated_at
  BEFORE UPDATE ON markers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE markers ENABLE ROW LEVEL SECURITY;

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
COMMENT ON TABLE markers IS 'User travel markers with status, content, and metadata';

COMMENT ON COLUMN cities.simplemaps_id IS 'SimpleMaps 10-digit unique ID for data consistency across updates';
COMMENT ON COLUMN cities.name IS 'Unicode city name (e.g. Goiânia)';
COMMENT ON COLUMN cities.name_ascii IS 'ASCII representation for search and sorting (e.g. Goiania)';
COMMENT ON COLUMN cities.admin_name IS 'Highest level admin region (state/province) - retained for future scalability beyond country-level MVP';
COMMENT ON COLUMN cities.population IS 'Urban population estimate (may be null for smaller cities)';
COMMENT ON COLUMN user_profiles.home_city_id IS 'Reference to user home city (can be null if not set)';
COMMENT ON COLUMN markers.visit_dates IS 'JSONB array of visit periods with start and end dates: [{start: "2024-01-15", end: "2024-01-20"}, ...]';
COMMENT ON COLUMN markers.companions IS 'Array of companion names/descriptions';
COMMENT ON COLUMN markers.activities IS 'Array of activities done at this location';
COMMENT ON COLUMN markers.photo_urls IS 'Array of Cloudinary photo URLs';
