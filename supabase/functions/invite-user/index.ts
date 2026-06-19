import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Use service role client for all DB operations (bypasses RLS)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify caller JWT and get their user ID
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Check caller is admin using service role (no RLS issues)
    const { data: callerRecord } = await adminClient
      .from('app_users')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerRecord?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: corsHeaders });
    }

    const { email, full_name, role } = await req.json();
    if (!email || !role) {
      return new Response(JSON.stringify({ error: 'email and role required' }), { status: 400, headers: corsHeaders });
    }

    // Invite user via Supabase Auth
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
      redirectTo: `${req.headers.get('origin') || Deno.env.get('SITE_URL') || ''}/accept-invite`,
    });
    if (inviteError) {
      const msg = inviteError.message || inviteError.code || String(inviteError) || 'Auth invite failed';
      console.error('inviteUserByEmail error:', { message: inviteError.message, status: inviteError.status, code: inviteError.code, name: inviteError.name });
      return new Response(JSON.stringify({ error: msg, status: inviteError.status, code: inviteError.code }), {
        status: inviteError.status || 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert into app_users (handles re-invite where auth user already exists)
    const { error: insertError } = await adminClient.from('app_users').upsert({
      id: inviteData.user.id,
      email,
      full_name: full_name || null,
      role,
    }, { onConflict: 'id' });
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err?.message || err?.error_description || err?.msg
      || (typeof err === 'string' ? err : JSON.stringify(err));
    console.error('invite-user error:', msg, err);
    return new Response(JSON.stringify({ error: msg || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
