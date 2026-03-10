const TOKEN_KEY = 'airealcheck_token';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function authHeaders(token?: string | null): Record<string, string> {
  const t = token ?? getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface FetchOptions {
  method?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: Record<string, unknown> | FormData | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  token?: string | null;
}

export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  if (!API_BASE) {
    throw new Error('NEXT_PUBLIC_API_URL is required');
  }
  const { method = 'GET', body = null, headers = {}, signal, token } = opts;
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...authHeaders(token),
    ...headers,
  };

  const fetchOpts: RequestInit = { method, headers: finalHeaders, credentials: 'include', signal };

  if (body instanceof FormData) {
    fetchOpts.body = body;
  } else if (body !== null && body !== undefined) {
    fetchOpts.body = JSON.stringify(body);
    finalHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, fetchOpts);
  let data: unknown = null;
  try {
    data = await response.clone().json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const err = new Error(
      ((data as Record<string, string> | null)?.error || (data as Record<string, string> | null)?.message) || 'request_failed'
    ) as Error & { status: number; response: unknown };
    err.status = response.status;
    (err as { status: number; response: unknown }).response = data;
    throw err;
  }

  return data as T;
}
