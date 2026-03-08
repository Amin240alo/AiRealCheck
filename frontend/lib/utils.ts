import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('de-DE', {
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
