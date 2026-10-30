/**
 * Adresse du projet Supabase de SimuFlow et sa clé publique.
 *
 * Ces deux valeurs sont publiques par conception : elles sont dans l'app que
 * chacun installe. Elles permettent de parler au serveur, pas de tout y lire :
 * ce que chacun peut voir ou modifier est décidé côté serveur, par les règles
 * de sécurité des tables (Row Level Security). La clé secrète (service_role)
 * et le mot de passe de la base ne sont jamais dans l'app.
 */
export const SUPABASE_URL = 'https://szcdixoqdlclhzxrrznr.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_C63R5mk6dOtyne63AR8qLQ_4xdypgyl';
