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
    if (inviteError) throw inviteError;

    // Insert into app_users
    const { error: insertError } = await adminClient.from('app_users').insert({
      id: inviteData.user.id,
      email,
      full_name: full_name || null,
      role,
    });
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
