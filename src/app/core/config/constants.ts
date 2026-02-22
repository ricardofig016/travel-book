// API endpoints and constants configuration

export const API_CONFIG = {
  // Supabase table names
  tables: {
    markers: 'markers',
    cities: 'cities',
    countries: 'countries',
    regions: 'regions',
  },

  // Cloudinary configuration
  cloudinary: {
    folder: 'travel-book', // Folder name in Cloudinary
    maxFileSize: 10485760, // 10MB in bytes
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  },

  // Pagination defaults
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },

  // Cache configuration
  cache: {
    citiesExpiry: 86400000, // 24 hours in milliseconds
    countriesExpiry: 604800000, // 7 days in milliseconds
  },

  // Map configuration
  map: {
    defaultZoom: 2,
    maxZoom: 18,
    minZoom: 1,
  },
} as const;

// Storage keys for local storage
export const STORAGE_KEYS = {
  markers: 'travel_book_markers',
  mapState: 'travel_book_map_state',
  bookmarks: 'travel_book_bookmarks',
  lastSync: 'travel_book_last_sync',
  userPreferences: 'travel_book_user_preferences',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  network: 'Network error. Please check your connection.',
  timeout: 'Request timed out. Please try again.',
  unauthorized: 'Unauthorized access. Please log in.',
  notFound: 'Resource not found.',
  serverError: 'Server error. Please try again later.',
  uploadFailed: 'Failed to upload image. Please try again.',
  invalidFormat: 'Invalid file format.',
  fileTooLarge: 'File size exceeds maximum limit.',
} as const;
