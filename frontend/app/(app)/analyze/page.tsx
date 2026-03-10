'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon, Video, Music, Upload, Link as LinkIcon,
  AlertTriangle, X, ShieldCheck, BarChart2, Archive, Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, getToken, API_BASE } from '@/lib/api';
import type { AnalysisResult, MediaType } from '@/lib/types';
import { ResultCard } from '@/components/analysis/ResultCard';

// ── Constants ─────────────────────────────────────────────────────────────────

const COSTS: Record<MediaType, number> = { image: 10, video: 25, audio: 15 };

const ACCEPT_MIME: Record<MediaType, Set<string>> = {
  image: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  video: new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/mov']),
  audio: new Set(['audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/ogg', 'audio/x-m4a', 'audio/x-wav', 'audio/aac']),
};

const ACCEPT_EXT: Record<MediaType, Set<string>> = {
  image: new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']),
  video: new Set(['mp4', 'mov', 'webm', 'm4v']),
  audio: new Set(['mp3', 'wav', 'm4a', 'ogg', 'aac']),
};

const ACCEPT_INPUT: Record<MediaType, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/mov,video/webm,video/quicktime,video/x-m4v',
  audio: 'audio/mpeg,audio/wav,audio/m4a,audio/mp4,audio/ogg',
};

const ACCEPT_HINTS: Record<MediaType, string> = {
  image: 'JPG · PNG · WebP · GIF',
  video: 'MP4 · MOV · WebM',
  audio: 'MP3 · WAV · M4A · OGG',
};

const SIZE_LIMITS: Record<MediaType, number> = {
  image: 20 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
};

const SIZE_LIMIT_LABELS: Record<MediaType, string> = {
  image: '20 MB', video: '200 MB', audio: '50 MB',
};

const DURATION_LIMITS: Record<MediaType, number | null> = {
  image: null, video: 300, audio: 600,
};

const DURATION_LABELS: Record<MediaType, string | null> = {
  image: null, video: 'max. 5 Min.', audio: 'max. 10 Min.',
};

const TYPE_LABELS: Record<MediaType, string> = { image: 'Bild', video: 'Video', audio: 'Audio' };
const TIMEOUT_MS = 180000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const tag = file.type.startsWith('video') ? 'video' : 'audio';
    const el = document.createElement(tag) as HTMLVideoElement | HTMLAudioElement;
    el.preload = 'metadata'; el.src = url;
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(el.duration); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(); };
  });
}

async function validateFile(file: File, type: MediaType): Promise<string | null> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ACCEPT_MIME[type].has(file.type) && !ACCEPT_EXT[type].has(ext)) {
    return `Format nicht unterstützt. Erlaubt: ${ACCEPT_HINTS[type]}`;
  }
  if (file.size > SIZE_LIMITS[type]) {
    return `Datei zu groß (${formatFileSize(file.size)}). Maximum: ${SIZE_LIMIT_LABELS[type]}`;
  }
  const durationLimit = DURATION_LIMITS[type];
  if (durationLimit !== null) {
    try {
      const dur = await getMediaDuration(file);
      if (Number.isFinite(dur) && dur > durationLimit) {
        const mins = Math.floor(dur / 60);
        const secs = Math.round(dur % 60);
        return `Zu lang (${mins}:${String(secs).padStart(2, '0')} Min.). ${DURATION_LABELS[type]}`;
      }
    } catch { /* non-blocking */ }
  }
  return null;
}

// ── Info Panel ────────────────────────────────────────────────────────────────

function InfoPanel() {
  const items = [
    { icon: ShieldCheck, accent: '#22d3ee', title: 'Eindeutiges Urteil', desc: 'KI-generiert, echt oder unklar — immer mit klarer Begründung.' },
    { icon: BarChart2, accent: '#a78bfa', title: 'Konfidenz-Score', desc: 'Hoch, Mittel oder Niedrig — du siehst, wie sicher das Ergebnis ist.' },
    { icon: Zap, accent: '#22d3ee', title: 'Technische Signale', desc: 'Details aus mehreren KI-Engines: Bildforensik, Metadaten, C2PA.' },
    { icon: Archive, accent: '#a78bfa', title: 'Automatischer Verlauf', desc: 'Jede Analyse wird gespeichert — filterbar und jederzeit abrufbar.' },
  ];
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-muted)] mb-5">Was du bekommst</div>
      <div className="space-y-4">
        {items.map(({ icon: Icon, accent, title, desc }) => (
          <div key={title} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: accent + '18', border: `1px solid ${accent}30` }}>
              <Icon size={14} style={{ color: accent }} />
            </div>
            <div>
              <div className="text-[13px] font-medium text-[var(--color-text)]">{title}</div>
              <div className="text-[12px] text-[var(--color-muted)] mt-0.5 leading-relaxed">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const router = useRouter();
  const { isLoggedIn, isEmailVerified, balance, refreshBalance, resendVerify } = useAuth();
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [inputMode, setInputMode] = useState<'file' | 'link'>('file');
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [url, setUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [serverError, setServerError] = useState('');
  const [resendStatus, setResendStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const cost = COSTS[mediaType];
  const credits = balance?.credits_available ?? 0;
  const hasEnoughCredits = credits >= cost;

  useEffect(() => {
    setStagedFile(null); setFileError(null); setUrl(''); setResult(null); setServerError('');
  }, [mediaType, inputMode]);

  const handleFile = useCallback(async (f: File | undefined) => {
    if (!f) return;
    setValidating(true); setFileError(null); setStagedFile(null);
    const err = await validateFile(f, mediaType);
    setValidating(false);
    if (err) setFileError(err);
    else setStagedFile(f);
  }, [mediaType]);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    await handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropRef.current || !dropRef.current.contains(e.relatedTarget as Node)) setDragging(false);
  }, []);

  async function handleResendVerify() {
    setResendStatus('Senden…');
    try { await resendVerify(); setResendStatus('Gesendet!'); }
    catch { setResendStatus('Fehler'); }
  }

  async function startAnalysis() {
    if (!isLoggedIn) { router.push('/login'); return; }
    if (!isEmailVerified) { setServerError('Bitte bestätige deine E-Mail-Adresse zuerst.'); return; }
    if (!hasEnoughCredits) { setServerError(`Nicht genug Credits. Du hast ${credits}, brauchst ${cost}.`); return; }
    if (inputMode === 'link' && mediaType !== 'video') { setServerError('Link-Analyse ist nur für Videos verfügbar.'); return; }
    if (inputMode === 'file' && !stagedFile) { setServerError('Bitte zuerst eine Datei auswählen.'); return; }
    if (inputMode === 'link' && !url) { setServerError('Bitte einen Link eingeben.'); return; }
    if (inputMode === 'link' && !/^https?:\/\//i.test(url)) { setServerError('Nur http/https Links sind erlaubt.'); return; }

    setServerError(''); setResult(null); setAnalyzing(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const token = getToken();

    try {
      let data: AnalysisResult;
      if (inputMode === 'file') {
        const formData = new FormData();
        formData.append('file', stagedFile!);
        formData.append('type', mediaType);
        formData.append('force', 'true');
        const resp = await fetch(`${API_BASE}/analyze?t=${Date.now()}`, {
          method: 'POST',
          headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: formData,
          signal: controller.signal,
        });
        data = await resp.json();
        if (!resp.ok) throw Object.assign(new Error((data as { message?: string })?.message || 'Fehler'), { status: resp.status, response: data });
      } else {
        data = await apiFetch<AnalysisResult>('/analyze/video-url', {
          method: 'POST',
          body: { url, type: 'video', force: true },
          signal: controller.signal,
        });
      }
      if ((data as { usage?: { credits_left?: number } }).usage?.credits_left !== undefined) {
        await refreshBalance();
      }
      setResult(data);
    } catch (err: unknown) {
      const e = err as { name?: string; status?: number; response?: { error?: string } };
      if (e?.name === 'AbortError') { setServerError('Zeitüberschreitung bei der Verbindung.'); return; }
      if (e?.status === 401) { router.push('/login'); return; }
      if (e?.status === 403 && e?.response?.error === 'email_not_verified') { setServerError('Bitte bestätige deine E-Mail-Adresse.'); return; }
      if (e?.status === 402 || e?.status === 409) { setServerError('Nicht genug Credits.'); return; }
      if (e?.status === 429) { setServerError('Zu viele Anfragen. Bitte kurz warten.'); return; }
      setServerError('Verbindung zum Server fehlgeschlagen.');
    } finally {
      clearTimeout(timeout);
      setAnalyzing(false);
    }
  }

  function reset() {
    setStagedFile(null); setFileError(null); setUrl('');
    setResult(null); setServerError('');
  }

  const dropzoneStyle: React.CSSProperties = dragging
    ? { borderColor: '#22d3ee', boxShadow: '0 0 0 1px rgba(34,211,238,0.35), 0 0 32px rgba(34,211,238,0.12)', background: 'rgba(34,211,238,0.04)' }
    : stagedFile
    ? { borderColor: 'rgba(34,211,238,0.45)', boxShadow: '0 0 16px rgba(34,211,238,0.07)' }
    : {};

  const MediaIcon = mediaType === 'image' ? ImageIcon : mediaType === 'video' ? Video : Music;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-7">
        <h1 className="text-[24px] font-bold text-[var(--color-text)]">KI-Inhalte erkennen</h1>
        <p className="text-[14px] text-[var(--color-muted)] mt-1">Prüfe Bilder, Videos und Audio auf KI-Erzeugung.</p>
      </div>

      {/* Email verify banner */}
      {isLoggedIn && !isEmailVerified && (
        <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-warning-muted)] border border-[var(--color-warning)] border-opacity-30">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
          <div>
            <div className="text-[13px] font-medium text-[var(--color-warning)]">E-Mail bestätigen</div>
            <div className="text-[12px] text-[var(--color-muted)] mt-0.5">Ohne Verifikation sind Analysen gesperrt.</div>
            <button onClick={handleResendVerify} className="text-[12px] text-[var(--color-primary)] hover:underline mt-1">
              {resendStatus || 'Bestätigungs-E-Mail erneut senden'}
            </button>
          </div>
        </div>
      )}

      {/* Grid: upload card + info panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-5 mb-5">

        {/* Upload card */}
        <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">

          {/* Media type */}
          <div className="mb-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">Medientyp</div>
            <div className="grid grid-cols-3 gap-2.5">
              {(['image', 'video', 'audio'] as MediaType[]).map(type => {
                const Icon = type === 'image' ? ImageIcon : type === 'video' ? Video : Music;
                const active = mediaType === type;
                return (
                  <button key={type} onClick={() => setMediaType(type)}
                    className={`flex flex-col items-center gap-2 py-3.5 px-2 rounded-[var(--radius-lg)] border transition-all duration-150 ${
                      active
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-2)] hover:bg-[var(--color-surface-2)] text-[var(--color-muted)]'
                    }`}>
                    <Icon size={20} />
                    <span className="text-[12px] font-medium">{TYPE_LABELS[type]}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]' : 'bg-[var(--color-surface-3)] text-[var(--color-muted-2)]'}`}>
                      {COSTS[type]} Cr.
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input mode toggle */}
          <div className="flex items-center gap-1 mb-5 p-1 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] w-fit">
            {(['file', 'link'] as const).map(mode => (
              <button key={mode} onClick={() => setInputMode(mode)}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-[var(--radius-sm)] text-[12px] font-medium transition-all ${
                  inputMode === mode
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}>
                {mode === 'file' ? <Upload size={11} /> : <LinkIcon size={11} />}
                {mode === 'file' ? 'Datei' : 'Link'}
              </button>
            ))}
          </div>

          {/* Input area */}
          <AnimatePresence mode="wait">
            {inputMode === 'file' ? (
              <motion.div key="file" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <div
                  ref={dropRef}
                  onClick={() => !stagedFile && !validating && fileRef.current?.click()}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  style={dropzoneStyle}
                  className={`relative rounded-[var(--radius-lg)] border-2 border-dashed transition-all duration-200 ${
                    stagedFile || validating ? 'cursor-default' : 'cursor-pointer hover:border-[var(--color-muted-2)]'
                  } ${!dragging && !stagedFile ? 'border-[var(--color-border-2)]' : ''}`}
                >
                  <AnimatePresence mode="wait">
                    {stagedFile ? (
                      <motion.div key="staged" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.15 }}
                        className="flex items-center gap-4 p-5">
                        <div className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.22)' }}>
                          <MediaIcon size={18} style={{ color: '#22d3ee' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-[var(--color-text)] truncate">{stagedFile.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-[var(--color-muted)]">{formatFileSize(stagedFile.size)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-success-muted)] text-[var(--color-success)]">Bereit</span>
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setStagedFile(null); setFileError(null); }}
                          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors flex-shrink-0">
                          <X size={14} />
                        </button>
                      </motion.div>
                    ) : validating ? (
                      <motion.div key="validating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center gap-3 py-12">
                        <svg className="animate-spin w-5 h-5 text-[var(--color-muted)]" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                        </svg>
                        <span className="text-[12px] text-[var(--color-muted)]">Datei wird geprüft…</span>
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
                        <div className="w-14 h-14 rounded-[var(--radius-xl)] flex items-center justify-center transition-all duration-200"
                          style={{
                            background: dragging ? 'rgba(34,211,238,0.12)' : 'rgba(34,211,238,0.06)',
                            border: `1px solid rgba(34,211,238,${dragging ? '0.35' : '0.15'})`,
                          }}>
                          <MediaIcon size={26} style={{ color: dragging ? '#22d3ee' : 'var(--color-muted)' }} />
                        </div>
                        <div>
                          <div className="text-[14px] font-medium text-[var(--color-text)]">
                            {dragging ? 'Datei hier loslassen' : 'Datei ablegen oder klicken'}
                          </div>
                          <div className="mt-2 space-y-0.5">
                            <div className="text-[12px] text-[var(--color-muted)]">{ACCEPT_HINTS[mediaType]}</div>
                            <div className="text-[11px] text-[var(--color-muted-2)]">
                              max. {SIZE_LIMIT_LABELS[mediaType]}
                              {DURATION_LABELS[mediaType] && ` · ${DURATION_LABELS[mediaType]}`}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {fileError && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)] border-opacity-30 text-[var(--color-danger)] text-[12px]">
                        <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                        <span>{fileError}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <input ref={fileRef} type="file" accept={ACCEPT_INPUT[mediaType]} className="hidden"
                  onChange={e => handleFile(e.target.files?.[0])} />

                {stagedFile && (
                  <button onClick={() => fileRef.current?.click()}
                    className="mt-2 text-[12px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
                    Andere Datei wählen
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div key="link" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {mediaType !== 'video' && (
                  <div className="mb-3 flex items-center gap-1.5 text-[12px] text-[var(--color-muted)]">
                    <AlertTriangle size={12} className="text-[var(--color-warning)]" />
                    Link-Analyse ist aktuell nur für Videos verfügbar.
                  </div>
                )}
                <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
                  disabled={mediaType !== 'video'}
                  className="w-full h-11 px-3.5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[14px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-40 transition-colors" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Server error */}
          <AnimatePresence>
            {serverError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3">
                <div className="flex items-start gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)] border-opacity-30 text-[var(--color-danger)] text-[13px]">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="text-[13px] text-[var(--color-muted)]">
              {cost} Credits
              {isLoggedIn && (
                <span className={`ml-2 text-[12px] ${hasEnoughCredits ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  · {credits} verfügbar
                </span>
              )}
            </div>
            <button
              onClick={startAnalysis}
              disabled={analyzing || (inputMode === 'file' && !stagedFile) || validating}
              className="h-10 px-6 rounded-[var(--radius-md)] text-white text-[13px] font-semibold disabled:opacity-50 transition-opacity flex items-center gap-2 shadow-[var(--shadow-sm)]"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)' }}
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  Analysieren…
                </>
              ) : 'Analyse starten'}
            </button>
          </div>

          {/* Progress */}
          <AnimatePresence>
            {analyzing && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-4">
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between text-[12px] mb-2.5">
                    <span className="font-medium text-[var(--color-text)]">Engines analysieren…</span>
                    <span className="text-[var(--color-muted)]">Bis zu 3 Min.</span>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: '88%' }}
                      transition={{ duration: 25, ease: 'easeInOut' }}
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #06b6d4, #7c3aed)' }}
                    />
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)] mt-2">Bildforensik · Metadaten · KI-Modell-Abgleich</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info panel */}
        <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
          <InfoPanel />
        </div>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <ResultCard data={result} file={stagedFile} mediaType={mediaType} title={stagedFile?.name} onReset={reset} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not logged in CTA */}
      {!isLoggedIn && (
        <div className="mt-4 p-6 rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] text-center">
          <div className="text-[14px] font-semibold text-[var(--color-text)] mb-1">Analyse starten</div>
          <p className="text-[13px] text-[var(--color-muted)] mb-4">Erstelle ein kostenloses Konto, um sofort loszulegen.</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => router.push('/register')}
              className="h-9 px-5 rounded-[var(--radius-md)] text-white text-[13px] font-semibold"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)' }}>
              Kostenlos registrieren
            </button>
            <button onClick={() => router.push('/login')}
              className="h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-[var(--color-text)] text-[13px] font-medium hover:bg-[var(--color-surface-3)] transition-colors border border-[var(--color-border)]">
              Anmelden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
