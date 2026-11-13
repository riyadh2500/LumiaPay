// Jest setup file
// Add any global test setup here

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';
process.env.NEXT_PUBLIC_LUMIA_RPC_URL = process.env.NEXT_PUBLIC_LUMIA_RPC_URL || 'https://testnet.lumia.org';
