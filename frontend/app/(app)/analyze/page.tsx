'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Video, Music, Upload, Link as LinkIcon, CheckCircle2, XCircle, HelpCircle, ChevronDown, ChevronUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, getToken, API_BASE } from '@/lib/api';
import type { AnalysisResult, MediaType } from '@/lib/types';

const COSTS: Record<MediaType, number> = { image: 10, video: 25, audio: 15 };
const ACCEPT: Record<MediaType, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/mov,video/webm,video/quicktime',
  audio: 'audio/mpeg,audio/wav,audio/m4a,audio/mp4,audio/ogg',
};
const TYPE_LABELS: Record<MediaType, string> = { image: 'Bild', video: 'Video', audio: 'Audio' };
const ACCEPT_HINTS: Record<MediaType, string> = {
  image: 'JPG, PNG, WebP',
  video: 'MP4, MOV, WebM',
  audio: 'MP3, WAV, M4A',
};
const TIMEOUT_MS = 180000;

function getVerdict(data: AnalysisResult) {
  const fake = Number(data.fake || 0);
  const confidence = String(data.confidence || '').toLowerCase();
  if (fake >= 70 && confidence !== 'low') return 'fake';
  if ((100 - fake) >= 70 && confidence !== 'low') return 'real';
  return 'uncertain';
}

function ResultCard({ data, onReset }: { data: AnalysisResult; onReset: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const verdict = getVerdict(data);
  const fake = Math.round(Number(data.fake || 0));
  const confidence = data.confidence || 'low';
  const confLabel = confidence === 'high' ? 'Hoch' : confidence === 'medium' ? 'Mittel' : 'Niedrig';

  const verdictConfig = {
    real: { label: 'Wahrscheinlich echt', color: 'var(--color-success)', bg: 'var(--color-success-muted)', icon: CheckCircle2 },
    fake: { label: 'Wahrscheinlich KI-generiert', color: 'var(--color-danger)', bg: 'var(--color-danger-muted)', icon: XCircle },
    uncertain: { label: 'Unklar', color: 'var(--color-warning)', bg: 'var(--color-warning-muted)', icon: HelpCircle },
  }[verdict];
  const VIcon = verdictConfig.icon;

  const summaryLines = Array.isArray(data.user_summary) && data.user_summary.length
    ? data.user_summary
    : data.message ? [data.message] : ['Keine weiteren Details verfügbar.'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[var(--radius-lg)] border p-5"
      style={{ background: verdictConfig.bg, borderColor: verdictConfig.color + '40' }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: verdictConfig.bg, border: `2px solid ${verdictConfig.color}` }}>
            <VIcon size={20} style={{ color: verdictConfig.color }} />
          </div>
          <div>
            <div className="text-[15px] font-bold" style={{ color: verdictConfig.color }}>{verdictConfig.label}</div>
            <div className="text-[12px] text-[var(--color-muted)] mt-0.5">KI-Wahrscheinlichkeit: {fake}% · Sicherheit: {confLabel}</div>
          </div>
        </div>
        <button onClick={onReset} className="p-2 rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors flex-shrink-0">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[11px] text-[var(--color-muted)] mb-1">
          <span>Echt (0%)</span><span>KI (100%)</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${fake}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: verdictConfig.color }}
          />
        </div>
      </div>

      {/* Summary chips */}
      {data.usage && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-muted)]">
            {data.usage.credits_used} Credits verbraucht
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-muted)]">
            {data.usage.credits_left} Credits verbleibend
          </span>
        </div>
      )}

      {/* Details toggle */}
      <button
        onClick={() => setDetailsOpen(!detailsOpen)}
        className="flex items-center gap-1.5 text-[12px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Details {detailsOpen ? 'schliessen' : 'anzeigen'}
      </button>

      <AnimatePresence>
        {detailsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">Warum?</div>
              <ul className="space-y-1">
                {summaryLines.slice(0, 4).map((line, i) => (
                  <li key={i} className="text-[13px] text-[var(--color-muted)] flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-muted-2)] inline-block mt-1.5" />
                    {line}
                  </li>
                ))}
              </ul>
              {data.sources_used && data.sources_used.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">Engines</div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.sources_used.map(s => (
                      <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-muted)]">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AnalyzePage() {
  const router = useRouter();
  const { isLoggedIn, isEmailVerified, balance, refreshBalance, resendVerify } = useAuth();
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [inputMode, setInputMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [resendStatus, setResendStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cost = COSTS[mediaType];
  const credits = balance?.credits_available ?? 0;
  const hasEnoughCredits = credits >= cost;

  useEffect(() => {
    setFile(null); setUrl(''); setResult(null); setError('');
  }, [mediaType, inputMode]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  async function handleResendVerify() {
    setResendStatus('Senden…');
    try {
      await resendVerify();
      setResendStatus('Gesendet!');
    } catch {
      setResendStatus('Fehler');
    }
  }

  async function startAnalysis() {
    if (!isLoggedIn) { router.push('/login'); return; }
    if (!isEmailVerified) { setError('Bitte bestätige deine E-Mail-Adresse zuerst.'); return; }
    if (!hasEnoughCredits) { setError(`Nicht genug Credits. Du hast ${credits}, brauchst ${cost}.`); return; }

    if (inputMode === 'link' && mediaType !== 'video') {
      setError('Link-Analyse ist nur für Videos verfügbar.'); return;
    }
    if (inputMode === 'file' && !file) { setError('Bitte zuerst eine Datei auswählen.'); return; }
    if (inputMode === 'link' && !url) { setError('Bitte einen Link eingeben.'); return; }
    if (inputMode === 'link' && !/^https?:\/\//i.test(url)) {
      setError('Nur http/https Links sind erlaubt.'); return;
    }

    setError(''); setResult(null); setAnalyzing(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const token = getToken();

    try {
      let data: AnalysisResult;
      if (inputMode === 'file') {
        const formData = new FormData();
        formData.append('file', file!);
        formData.append('type', mediaType);
        formData.append('force', 'true');
        const resp = await fetch(`${API_BASE}/analyze?t=${Date.now()}`, {
          method: 'POST',
          headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: formData,
          signal: controller.signal,
        });
        data = await resp.json();
        if (!resp.ok) throw Object.assign(new Error(data?.message || 'Fehler'), { status: resp.status, response: data });
      } else {
        data = await apiFetch<AnalysisResult>('/analyze/video-url', {
          method: 'POST',
          body: { url, type: 'video', force: true },
          signal: controller.signal,
        });
      }

      if (data.usage?.credits_left !== undefined) {
        await refreshBalance();
      }
      setResult(data);
    } catch (err: unknown) {
      const e = err as { name?: string; status?: number; response?: { error?: string } };
      if (e?.name === 'AbortError') { setError('Zeitüberschreitung bei der Verbindung.'); return; }
      if (e?.status === 401) { router.push('/login'); return; }
      if (e?.status === 403 && e?.response?.error === 'email_not_verified') {
        setError('Bitte bestätige deine E-Mail-Adresse.'); return;
      }
      if (e?.status === 402 || e?.status === 409) { setError('Nicht genug Credits.'); return; }
      if (e?.status === 429) { setError('Zu viele Anfragen. Bitte kurz warten.'); return; }
      setError('Verbindung zum Server fehlgeschlagen.');
    } finally {
      clearTimeout(timeout);
      setAnalyzing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[var(--color-text)]">KI-Inhalte erkennen</h1>
        <p className="text-[13px] text-[var(--color-muted)] mt-1">Prüfe Bilder, Videos oder Audio auf KI-Manipulation.</p>
      </div>

      {/* Email verify banner */}
      {isLoggedIn && !isEmailVerified && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-warning-muted)] border border-[var(--color-warning)] border-opacity-30">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
          <div>
            <div className="text-[13px] font-medium text-[var(--color-warning)]">Bitte E-Mail bestätigen</div>
            <div className="text-[12px] text-[var(--color-muted)] mt-0.5">Ohne Verifikation sind Analysen gesperrt.</div>
            <button onClick={handleResendVerify} className="text-[12px] text-[var(--color-primary)] hover:underline mt-1">
              {resendStatus || 'Bestätigungs-E-Mail erneut senden'}
            </button>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
        {/* Media type selector */}
        <div className="mb-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">Medientyp wählen</div>
          <div className="grid grid-cols-3 gap-2">
            {(['image', 'video', 'audio'] as MediaType[]).map(type => (
              <button
                key={type}
                onClick={() => setMediaType(type)}
                className={`flex flex-col items-center gap-2 p-3 rounded-[var(--radius-md)] border transition-all duration-150 ${
                  mediaType === type
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-2)] hover:bg-[var(--color-surface-2)] text-[var(--color-muted)]'
                }`}
              >
                {type === 'image' ? <ImageIcon size={20} /> : type === 'video' ? <Video size={20} /> : <Music size={20} />}
                <span className="text-[12px] font-medium">{TYPE_LABELS[type]} prüfen</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-muted-2)]">{COSTS[type]} Credits</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input mode tabs */}
        <div className="flex items-center gap-1 mb-4 p-1 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] w-fit">
          {(['file', 'link'] as const).map(mode => (
            <button key={mode} onClick={() => setInputMode(mode)}
              className={`flex items-center gap-1.5 h-7 px-3 rounded-[var(--radius-sm)] text-[12px] font-medium transition-all ${
                inputMode === mode ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]' : 'text-[var(--color-muted)]'
              }`}>
              {mode === 'file' ? <Upload size={12} /> : <LinkIcon size={12} />}
              {mode === 'file' ? 'Datei' : 'Link'}
            </button>
          ))}
        </div>

        {/* Input area */}
        <AnimatePresence mode="wait">
          {inputMode === 'file' ? (
            <motion.div key="file" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-[var(--radius-lg)] border-2 border-dashed cursor-pointer transition-all duration-150 ${
                  dragging
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]'
                    : file
                      ? 'border-[var(--color-success)] bg-[var(--color-success-muted)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-2)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                {file ? (
                  <>
                    <CheckCircle2 size={28} className="text-[var(--color-success)]" />
                    <div className="text-center">
                      <div className="text-[13px] font-medium text-[var(--color-text)]">{file.name}</div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload size={28} className="text-[var(--color-muted-2)]" />
                    <div className="text-center">
                      <div className="text-[13px] text-[var(--color-text)]">Datei hier hineinziehen oder klicken</div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">{ACCEPT_HINTS[mediaType]}</div>
                    </div>
                  </>
                )}
                <input ref={fileRef} type="file" accept={ACCEPT[mediaType]} className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
            </motion.div>
          ) : (
            <motion.div key="link" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {mediaType !== 'video' && (
                <div className="mb-3 text-[12px] text-[var(--color-muted)] flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-[var(--color-warning)]" />
                  Link-Analyse ist aktuell nur für Videos verfügbar.
                </div>
              )}
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                disabled={mediaType !== 'video'}
                className="w-full h-10 px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 transition-colors"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)] border-opacity-30 text-[var(--color-danger)] text-[13px]">
            {error}
          </motion.div>
        )}

        {/* Analyze button */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-[12px] text-[var(--color-muted)]">
            Kosten: <strong className="text-[var(--color-text)]">{cost} Credits</strong>
            {isLoggedIn && (
              <span className={`ml-2 ${hasEnoughCredits ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                (Verfügbar: {credits})
              </span>
            )}
          </div>
          <button
            onClick={startAnalysis}
            disabled={analyzing || (inputMode === 'file' && !file)}
            className="h-9 px-5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {analyzing
              ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg> Analysieren…</>
              : 'Analyse starten'}
          </button>
        </div>

        {/* Progress */}
        <AnimatePresence>
          {analyzing && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <div className="text-[13px] font-medium text-[var(--color-text)] mb-3">Analyse läuft…</div>
                <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '85%' }}
                    transition={{ duration: 20, ease: 'easeInOut' }}
                    className="h-full rounded-full bg-[var(--color-primary)]"
                  />
                </div>
                <div className="text-[11px] text-[var(--color-muted)] mt-2">Mehrere Engines analysieren gleichzeitig…</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
            <ResultCard data={result} onReset={() => { setResult(null); setFile(null); setUrl(''); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not logged in CTA */}
      {!isLoggedIn && (
        <div className="mt-4 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-center">
          <p className="text-[13px] text-[var(--color-muted)] mb-3">Bitte anmelden um Analysen zu starten.</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => router.push('/login')} className="h-8 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[12px] font-semibold hover:bg-[var(--color-primary-hover)] transition-colors">Anmelden</button>
            <button onClick={() => router.push('/register')} className="h-8 px-4 rounded-[var(--radius-md)] bg-[var(--color-surface-3)] text-[var(--color-text)] text-[12px] font-medium hover:bg-[var(--color-surface-2)] transition-colors border border-[var(--color-border)]">Registrieren</button>
          </div>
        </div>
      )}
    </div>
  );
}
