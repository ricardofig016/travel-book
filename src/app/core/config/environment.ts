// Development environment configuration
// This file can be replaced during build by using the `fileReplacements` array in angular.json

export const environment = {
  production: false,
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
