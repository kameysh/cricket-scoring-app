import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Web Push (VAPID) implementation using the WebCrypto API available in Deno
// Payload: { userIds?: string[], title: string, body: string, url?: string, tag?: string }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function importVapidKey(base64: string, usage: KeyUsage[]) {
  const bin = Uint8Array.from(atob(base64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', bin, { name: 'ECDH', namedCurve: 'P-256' }, true, usage);
}

async function signVapid(audience: string, subject: string, privateKeyB64: string): Promise<string> {
  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = btoa(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject,
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const bin = Uint8Array.from(atob(privateKeyB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const privKey = await crypto.subtle.importKey(
    'pkcs8', bin,
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${payload}.${sigB64}`;
}

async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublic: string,
  vapidPrivate: string,
  vapidSubject: string,
): Promise<boolean> {
  try {
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await signVapid(audience, vapidSubject, vapidPrivate);

    const resp = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        Authorization: `vapid t=${jwt},k=${vapidPublic}`,
        TTL: '86400',
      },
      body: new TextEncoder().encode(payload),
    });
    return resp.status < 300 || resp.status === 410; // 410 = subscription expired (treat as sent)
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await adminClient.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    const { data: appUser } = await adminClient.from('app_users').select('role').eq('id', user.id).single();
    if (!appUser || !['admin', 'scorer'].includes(appUser.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS });
    }

    const { userIds, title, body, url = '/', tag = 'cricket' } = await req.json();
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@cricket.app';

    // Fetch subscriptions
    let query = adminClient.from('push_subscriptions').select('*');
    if (userIds?.length) query = query.in('user_id', userIds);
    const { data: subs, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({ title, body, url, tag });
    const results = await Promise.allSettled(
      (subs || []).map(s => sendPushToSubscription(s, payload, vapidPublic, vapidPrivate, vapidSubject))
    );

    // Remove expired subscriptions (410 Gone)
    // (simplified — full implementation would track which sub returned 410)

    const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
    return new Response(JSON.stringify({ sent, total: (subs || []).length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
