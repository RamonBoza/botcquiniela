const DEVELOPMENT_SESSION_KEY = 'qc_development_tab_session';

function usesTabSession() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  if (usesTabSession()) {
    headers.set('x-qc-tab-session', '1');
    const token = window.sessionStorage.getItem(DEVELOPMENT_SESSION_KEY);
    if (token) headers.set('authorization', `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}

export function saveDevelopmentSession(token?: string) {
  if (usesTabSession() && token)
    window.sessionStorage.setItem(DEVELOPMENT_SESSION_KEY, token);
}

export function clearDevelopmentSession() {
  if (usesTabSession())
    window.sessionStorage.removeItem(DEVELOPMENT_SESSION_KEY);
}
