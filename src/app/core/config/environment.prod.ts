// Production environment configuration
// This file will be used when building for production

export const environment = {
  production: true,
  supabase: {
    url: 'https://laysppaihvoozpflhgba.supabase.co',
    publishableKey: 'sb_publishable_JWU45WJwVbBES-Fbh32zSg_r5nMQbgo',
  },
  cloudinary: {
    cloudName: 'dkpf6sa1o',
    uploadPreset: 'travel-book',
  },
  api: {
    timeout: 10000, // 10 seconds
    retryAttempts: 3,
  },
};
