// =============================================================================
// Supabase Edge Function „delete-account“ – Konto und alle Daten löschen
// -----------------------------------------------------------------------------
// Ablauf (aufgerufen vom Spiel: Einstellungen › Konto › „Konto und Daten löschen“):
//   1. Clerk-Session-Token prüfen: Signatur über die öffentlichen Schlüssel (JWKS) der Clerk-Instanz,
//      Aussteller (iss), Ablauf (exp) und – falls vorhanden – Herkunft (azp) gegen ALLOWED_ORIGINS.
//      Die Konto-ID kommt ausschließlich aus dem geprüften Token (sub), nie aus dem Request-Body.
//   2. Bestätigung im Body: { "confirm": "DELETE" }.
//   3. Alle Daten in Supabase löschen: public.af_delete_user_data(sub) (supabase/account.sql) mit dem
//      Service-Role-Key. Dieser Schlüssel umgeht RLS und existiert NUR hier auf dem Server.
//   4. Den Nutzer bei Clerk löschen (Backend API, Clerk Secret Key – ebenfalls nur hier auf dem Server).
//      Scheitert Schritt 4, sind die Spieldaten bereits gelöscht; ein erneuter Aufruf ist möglich.
//
// KEINE Secrets im Code. Alle Werte kommen aus Umgebungsvariablen:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  → stellt Supabase in Edge Functions automatisch bereit
//   CLERK_SECRET_KEY                         → supabase secrets set CLERK_SECRET_KEY=sk_live_…
//   CLERK_ISSUER                             → Frontend-API-URL der Clerk-Instanz, z. B. https://clerk.deine-domain.de
//                                              (Entwicklung: https://<name>.clerk.accounts.dev)
//   ALLOWED_ORIGINS                          → kommagetrennt, z. B. https://deine-domain.de,https://www.deine-domain.de
//
// Bereitstellen (das Clerk-Token wird hier selbst geprüft, daher ohne Supabase-JWT-Prüfung):
//   supabase functions deploy delete-account --no-verify-jwt
// =============================================================================
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string): string => Deno.env.get(k) ?? '';
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_ROLE = env('SUPABASE_SERVICE_ROLE_KEY');
const CLERK_SECRET = env('CLERK_SECRET_KEY');
const CLERK_ISSUER = env('CLERK_ISSUER').replace(/\/+$/, '');
const CLERK_API = (env('CLERK_API_URL') || 'https://api.clerk.com').replace(/\/+$/, '');
const ALLOWED = env('ALLOWED_ORIGINS').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
const JWKS = CLERK_ISSUER ? createRemoteJWKSet(new URL(CLERK_ISSUER + '/.well-known/jwks.json')) : null;

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : (ALLOWED[0] ?? 'null'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}
function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = (req.headers.get('origin') ?? '').replace(/\/+$/, '');
  const h = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, h);
  if (!SUPABASE_URL || !SERVICE_ROLE || !CLERK_SECRET || !JWKS || ALLOWED.length === 0) {
    console.error('delete-account: Umgebungsvariablen fehlen (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLERK_SECRET_KEY, CLERK_ISSUER, ALLOWED_ORIGINS)');
    return json({ error: 'not_configured' }, 500, h);
  }
  if (!ALLOWED.includes(origin)) return json({ error: 'origin_not_allowed' }, 403, h);

  // 1. Clerk-Token prüfen
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '');
  if (!m) return json({ error: 'unauthorized' }, 401, h);
  let userId: string;
  try {
    const { payload } = await jwtVerify(m[1], JWKS, { issuer: CLERK_ISSUER, clockTolerance: 5 });
    if (typeof payload.azp === 'string' && payload.azp && !ALLOWED.includes(payload.azp.replace(/\/+$/, ''))) throw new Error('azp');
    if (typeof payload.sub !== 'string' || !/^user_[A-Za-z0-9]{3,64}$/.test(payload.sub)) throw new Error('sub');
    userId = payload.sub;
  } catch (_e) {
    return json({ error: 'unauthorized' }, 401, h);
  }

  // 2. Ausdrückliche Bestätigung
  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch (_e) { body = {}; }
  if (body.confirm !== 'DELETE') return json({ error: 'confirmation_required' }, 400, h);

  // 3. Daten in Supabase löschen (Service-Role nur hier, serverseitig)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: deleted, error } = await admin.rpc('af_delete_user_data', { p_user: userId });
  if (error) {
    console.error('delete-account: Supabase-Löschung fehlgeschlagen', error.code, error.message);
    return json({ error: 'supabase_failed' }, 500, h);
  }

  // 4. Nutzer bei Clerk löschen (404 = bereits gelöscht)
  const r = await fetch(`${CLERK_API}/v1/users/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${CLERK_SECRET}` } });
  if (!r.ok && r.status !== 404) {
    console.error('delete-account: Clerk-Löschung fehlgeschlagen', r.status);
    return json({ error: 'clerk_failed', deleted }, 502, h);
  }
  // Keine Konto-ID oder andere personenbezogene Daten ins Log schreiben – nur die Anzahl gelöschter Zeilen
  console.log('delete-account: Konto gelöscht', JSON.stringify(deleted));
  return json({ ok: true, deleted }, 200, h);
});
