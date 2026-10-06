const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Content-Type': 'application/json',
};

const GITHUB_OWNER = 'p23ghodake';
const GITHUB_REPO = 'FamilyTree';
const GITHUB_FILE_PATH = 'src/data/g_familyData.json';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

function githubErrorStatus(status: number): number {
  if (status === 401 || status === 403) return 403;
  if (status === 409) return 409;
  return 500;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'GET' && request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: 'A valid Supabase access token is required.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or anon key is not configured for the family-data function.');
    return jsonResponse({ error: 'Server configuration error.' }, 500);
  }

  let authResponse: Response;
  try {
    authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    console.error('Supabase Auth validation request failed:', error);
    return jsonResponse({ error: 'Could not validate the Supabase session.' }, 500);
  }
  if (authResponse.status === 401 || authResponse.status === 403) {
    return jsonResponse({ error: 'The Supabase session is invalid or expired.' }, 401);
  }
  if (!authResponse.ok) {
    console.error(`Supabase Auth validation failed with status ${authResponse.status}.`);
    return jsonResponse({ error: 'Could not validate the Supabase session.' }, 500);
  }
  const user: unknown = await authResponse.json();
  if (typeof user !== 'object' || user === null || !('id' in user) || typeof user.id !== 'string') {
    console.error('Supabase Auth returned an unexpected user response.');
    return jsonResponse({ error: 'Could not validate the Supabase session.' }, 500);
  }

  const parseUsers = (name: string) => (Deno.env.get(name) ?? '')
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean);
  const editors = parseUsers('ALLOWED_GITHUB_USERS');
  const viewers = parseUsers('READONLY_GITHUB_USERS');
  const metadata = (user as { user_metadata?: Record<string, unknown> }).user_metadata ?? {};
  const login = [metadata.user_name, metadata.preferred_username]
    .find((value): value is string => typeof value === 'string' && value.length > 0)
    ?.toLowerCase();
  const email = typeof (user as { email?: unknown }).email === 'string'
    ? (user as { email: string }).email.toLowerCase()
    : undefined;
  const identities = [login, email].filter((value): value is string => !!value);
  const canEdit = identities.some(id => editors.includes(id));
  const canView = canEdit || identities.some(id => viewers.includes(id));
  if (!canView) {
    return jsonResponse({ error: 'Your GitHub account is not allowed to access family data.' }, 403);
  }
  if (request.method === 'PUT' && !canEdit) {
    return jsonResponse({ error: 'Your GitHub account has read-only access to family data.' }, 403);
  }

  const githubToken = Deno.env.get('GITHUB_TOKEN');
  if (!githubToken) {
    console.error('GITHUB_TOKEN is not configured for the family-data function.');
    return jsonResponse({ error: 'Server configuration error.' }, 500);
  }

  if (request.method === 'GET') {
    let githubResponse: Response;
    try {
      githubResponse = await fetch(GITHUB_API_URL, { headers: githubHeaders(githubToken) });
    } catch (error) {
      console.error('GitHub file read request failed:', error);
      return jsonResponse({ error: 'Could not connect to GitHub to read family data.' }, 500);
    }
    if (!githubResponse.ok) {
      const status = githubErrorStatus(githubResponse.status);
      console.error(`GitHub file read failed with status ${githubResponse.status}.`);
      return jsonResponse({ error: status === 403 ? 'GitHub denied access to the family data file.' : 'Failed to read family data from GitHub.' }, status);
    }

    const file = await githubResponse.json();
    if (typeof file.content !== 'string' || typeof file.sha !== 'string') {
      console.error('GitHub returned an unexpected Contents API response.');
      return jsonResponse({ error: 'GitHub returned an invalid family data file response.' }, 500);
    }

    try {
      return jsonResponse({ data: JSON.parse(decodeBase64(file.content)), sha: file.sha });
    } catch (error) {
      console.error('The family data file is not valid UTF-8 JSON:', error);
      return jsonResponse({ error: 'The family data file is not valid JSON.' }, 500);
    }
  }

  let body: { data?: unknown; sha?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }
  if (!body.data || typeof body.data !== 'object' || typeof body.sha !== 'string' || !body.sha) {
    return jsonResponse({ error: 'A family data object and current file SHA are required.' }, 400);
  }

  const content = `${JSON.stringify(body.data, null, 2)}\n`;
  let githubResponse: Response;
  try {
    githubResponse = await fetch(GITHUB_API_URL, {
      method: 'PUT',
      headers: githubHeaders(githubToken),
      body: JSON.stringify({
        message: 'Update family data from Family Tree app',
        content: encodeBase64(new TextEncoder().encode(content)),
        sha: body.sha,
      }),
    });
  } catch (error) {
    console.error('GitHub file update request failed:', error);
    return jsonResponse({ error: 'Could not connect to GitHub to save family data.' }, 500);
  }

  if (!githubResponse.ok) {
    const detail = await githubResponse.json().catch(() => null);
    const ruleBlocked = typeof detail?.message === 'string' && detail.message.includes('Repository rule violations');
    const status = ruleBlocked ? 403 : githubErrorStatus(githubResponse.status);
    console.error(`GitHub file update failed with status ${githubResponse.status}: ${detail?.message ?? 'no message'}`);
    return jsonResponse({
      error: status === 409
        ? `The family data changed on GitHub. Reload the latest version before saving again. (${detail?.message ?? 'no details'})`
        : status === 403
          ? `GitHub denied write access to the family data file. ${detail?.message ?? ''}`.trim()
          : `Failed to update family data on GitHub (${githubResponse.status}: ${detail?.message ?? 'no details'}).`,
    }, status);
  }

  const result = await githubResponse.json();
  if (typeof result.content?.sha !== 'string') {
    console.error('GitHub returned an unexpected update response.');
    return jsonResponse({ error: 'GitHub did not confirm the family data update.' }, 500);
  }
  return jsonResponse({ sha: result.content.sha });
});
