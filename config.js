const SUPABASE_URL = 'https://totyatoixqjzcvgybtib.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_J5ipUQG0t8VTdlUaZFs2dQ_-FFba7DZ';

if (!window.db) {
    window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}