// Etie Phase 8 — Supabase config (SAFE to commit: no secrets here)
// Plain English: paste your own keys to go online. Until then app stays offline demo.
// 1. Create project at https://supabase.com → Project Settings → API
// 2. Copy URL + anon public key below (NEVER the service_role key)
// 3. Reload index.html → header shows Cloud: on
window.ETIE_SUPABASE_URL = "https://pgcguatlmslbagbbqicr.supabase.co";
window.ETIE_SUPABASE_ANON_KEY = "sb_publishable_I2H83OIysjSBPSgXwvAcow_jegzLkpg";
// Optional: set to "etie-v1" to keep same local key
window.ETIE_CLOUD_TABLE = "etie_states";
// Phase 8b — shared live tables (set to null to disable live sync, stays offline demo)
window.ETIE_CLOUD_PROFILES_TABLE = "etie_profiles";
window.ETIE_CLOUD_REQUESTS_TABLE = "etie_requests";
window.ETIE_CLOUD_MESSAGES_TABLE = "etie_messages";
window.ETIE_CLOUD_MEETUPS_TABLE = "etie_meetups";
