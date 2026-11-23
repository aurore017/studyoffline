/* ==========================================================================
   CONFIGURATION  -  the only file you edit to connect the real backend
   --------------------------------------------------------------------------
   Paste your two Supabase values between the quotes:
     SUPABASE_URL  ->  Project Settings > API > Project URL
     SUPABASE_KEY  ->  Project Settings > API > "anon" key, or the key labelled
                       "publishable" (it may start with sb_publishable_ or eyJ)

   These two values are meant to be public: they are inside every web app that
   uses Supabase. The database rules (Row Level Security) are what protect
   your data.

   NEVER paste the "service_role" key or the "secret" key here.

   While the values below still say PASTE_..., the app keeps using the
   simulated server inside the browser, so nothing breaks.
   ========================================================================== */
window.SO = window.SO || {};

SO.config = {
  SUPABASE_URL: 'https://yjmczwheheddvqzzyxou.supabase.co/rest/v1/',
  SUPABASE_KEY: 'sb_publishable_izgLc3a3I58LSKIa1pw59g_czGkSSVG'
};
