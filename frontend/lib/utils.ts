import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LANG_TO_LOCALE, type Locale } from '@/lib/i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined, locale?: Locale): string {
  if (!dateStr) return '—';
  try {
    const intlLocale = locale ? LANG_TO_LOCALE[locale] : 'de-DE';
    return new Intl.DateTimeFormat(intlLocale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr: string | null | undefined, locale?: Locale): string {
  if (!dateStr) return '—';
  try {
    const intlLocale = locale ? LANG_TO_LOCALE[locale] : 'de-DE';
    return new Intl.DateTimeFormat(intlLocale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Returns a translation key for auth errors (use with t()). Keys match the errors namespace in i18n/index.ts. */
export function resolveAuthErrorKey(err: ApiError, mode = 'login'): string {
  const code = err?.response?.error;
  if (code === 'email_exists') return 'errors.email_exists';
  if (code === 'invalid_credentials') return 'errors.invalid_credentials';
  if (code === 'invalid_input') return 'errors.invalid_input';
  if (code === 'invalid_token') return 'errors.invalid_token';
  if (code === 'email_not_verified') return 'errors.email_not_verified';
  if (code === 'smtp_not_configured') return 'errors.smtp_not_configured';
  if (code === 'email_send_failed') return 'errors.email_send_failed';
  if (code === 'terms_not_accepted') return 'errors.terms_not_accepted';
  if (code === 'rate_limited' || err?.status === 429) return 'errors.rate_limited';
  if (err?.status === 403) return 'errors.forbidden';
  if (err?.status && err.status >= 500) return 'errors.server_error';
  return mode === 'login' ? 'errors.login_failed' : 'errors.action_failed';
}

/** Legacy: returns a German error string. Prefer resolveAuthErrorKey + t() in new code. */
export function resolveAuthError(err: ApiError, mode = 'login'): string {
  const code = err?.response?.error;
  if (code === 'email_exists') return 'Diese E-Mail ist bereits registriert.';
  if (code === 'invalid_credentials') return 'E-Mail oder Passwort ist falsch.';
  if (code === 'invalid_input') return 'Bitte alle Felder korrekt ausfüllen.';
  if (code === 'invalid_token') return 'Der Link ist ungültig oder abgelaufen.';
  if (code === 'email_not_verified') return 'Bitte bestätige zuerst deine E-Mail.';
  if (code === 'smtp_not_configured') return 'E-Mail-Versand ist in dieser Umgebung nicht aktiv.';
  if (code === 'email_send_failed') return 'E-Mail konnte nicht versendet werden.';
  if (code === 'terms_not_accepted') return 'Bitte AGB und Datenschutz akzeptieren.';
  if (code === 'rate_limited' || err?.status === 429) return 'Zu viele Versuche. Bitte kurz warten.';
  if (err?.status === 403) return 'Aktion nicht erlaubt.';
  if (err?.status && err.status >= 500) return 'Serverfehler. Bitte später erneut probieren.';
  return mode === 'login' ? 'Login fehlgeschlagen.' : 'Aktion fehlgeschlagen.';
}

export interface ApiError extends Error {
  status?: number;
  response?: { error?: string; message?: string; [key: string]: unknown };
}
