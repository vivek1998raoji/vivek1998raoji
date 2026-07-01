// Supabase Edge Function: create-tenant
// -----------------------------------------------------------------------
// Creates a tenant auth account WITHOUT exposing the service-role key to the
// browser. The landlord (an authenticated 'landlord' profile) invokes this;
// it verifies the caller is a landlord, then uses the service-role client to
// create the auth user and a matching profiles row (role = 'tenant').
//
// Deploy:  supabase functions deploy create-tenant
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//          (SUPABASE_* are injected automatically in the Supabase platform.)
// -----------------------------------------------------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) Verify the caller is an authenticated landlord.
    const authHeader = req.headers.get('Authorization') ?? '';
    const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await asCaller.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const { data: profile } = await asCaller.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'landlord') return json({ error: 'Only a landlord can create tenants' }, 403);

    // 2) Create the tenant auth user with the service-role client.
    const { email, password } = await req.json();
    if (!email || !password) return json({ error: 'email and password are required' }, 400);

    const admin = createClient(url, serviceKey);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) return json({ error: createErr.message }, 400);

    // 3) Record its role so RLS treats it as a tenant.
    await admin.from('profiles').upsert({ id: created.user.id, role: 'tenant' });

    return json({ user: { id: created.user.id, email } }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
