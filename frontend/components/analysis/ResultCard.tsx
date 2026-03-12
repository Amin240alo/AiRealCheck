'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, HelpCircle, AlertTriangle,
  Copy, Check, Download, History, Plus,
  ChevronDown, ChevronUp, Cpu, Clock,
  Image as ImageIcon, Video, Music,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  AnalysisResult, MediaType,
  PublicResultEngineEntry, PublicResultDetails,
  PublicResultMeta, PublicResultSummary, PublicResultUsage,
  VerdictKey,
} from '@/lib/types';
import { formatDate } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NormalizedAnalysis = {
  verdictKey: VerdictKey;
  verdictLabel: string;
  aiPercent: number | null;
  confidenceLabel: 'high' | 'medium' | 'low';
  confidence01?: number | null;
  reasons: string[];
  warnings: string[];
  engines: PublicResultEngineEntry[];
  sources: string[];
  details?: PublicResultDetails;
  meta?: PublicResultMeta;
  usage?: PublicResultUsage;
};

export interface ResultCardProps {
  data: AnalysisResult;
  file?: File | null;
  mediaType?: MediaType;
  title?: string;
  onReset?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<VerdictKey, {
  label: string;
  desc: string;
  color: string;
  colorRaw: string;
  bg: string;
  icon: React.ElementType;
}> = {
  likely_ai: {
    label: 'Wahrscheinlich KI-generiert',
    desc: 'Mehrere Merkmale deuten auf KI-erzeugte Inhalte hin.',
    color: 'var(--color-danger)',
    colorRaw: '#dc2626',
    bg: 'var(--color-danger-muted)',
    icon: XCircle,
  },
  likely_real: {
    label: 'Wahrscheinlich echt',
    desc: 'Keine charakteristischen KI-Merkmale erkannt.',
    color: 'var(--color-success)',
    colorRaw: '#16a34a',
    bg: 'var(--color-success-muted)',
    icon: CheckCircle2,
  },
  uncertain: {
    label: 'Unklar',
    desc: 'Das Ergebnis ist nicht eindeutig — manuelle Prüfung empfohlen.',
    color: 'var(--color-warning)',
    colorRaw: '#d97706',
    bg: 'var(--color-warning-muted)',
    icon: HelpCircle,
  },
};

const CONF_LABELS: Record<string, string> = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' };

const CONF_INFO: Record<string, { label: string; desc: string; color: string }> = {
  high: {
    label: 'Hohe Sicherheit',
    desc: 'Die Analysemethoden haben ein starkes, konsistentes Signal erkannt. Das Ergebnis ist mit hoher Zuverlässigkeit korrekt.',
    color: 'var(--color-success)',
  },
  medium: {
    label: 'Mittlere Sicherheit',
    desc: 'Die Signale sind erkennbar, aber nicht vollständig eindeutig. Das Ergebnis ist wahrscheinlich korrekt — sollte im Kontext bewertet werden.',
    color: 'var(--color-warning)',
  },
  low: {
    label: 'Niedrige Sicherheit',
    desc: 'Das Signal war schwach oder widersprüchlich. Das Ergebnis sollte mit Vorsicht interpretiert werden und ersetzt keine manuelle Prüfung.',
    color: 'var(--color-danger)',
  },
};

// ── Normalization ─────────────────────────────────────────────────────────────

function isPublicResult(data: AnalysisResult): data is { meta: PublicResultMeta; summary: PublicResultSummary; details?: PublicResultDetails; usage?: PublicResultUsage } {
  return Boolean((data as { meta?: PublicResultMeta })?.meta?.schema_version === 'public_result_v1');
}

function verdictFromAiPercent(v: number | null | undefined): VerdictKey {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'uncertain';
  if (v <= 20) return 'likely_real';
  if (v <= 60) return 'uncertain';
  return 'likely_ai';
}

export function normalizeAnalysisResult(data: AnalysisResult): NormalizedAnalysis {
  if (isPublicResult(data)) {
    const summary = data.summary || {};
    const details = data.details || {};
    const verdictKey = summary.verdict_key || verdictFromAiPercent(summary.ai_percent);
    const aiPercent = typeof summary.ai_percent === 'number' && Number.isFinite(summary.ai_percent)
      ? Math.max(0, Math.min(100, summary.ai_percent)) : null;
    const confidenceLabel = summary.confidence_label || 'low';
    const reasons = Array.isArray(summary.reasons_user) ? summary.reasons_user.filter(Boolean) : [];
    const warnings = Array.isArray(summary.warnings_user) ? summary.warnings_user.filter(Boolean) : [];
    if (summary.conflict) warnings.unshift('Konflikt zwischen Engines erkannt.');
    const engines = Array.isArray(details.engines) ? details.engines.filter(Boolean) : [];
    const sources = engines.map(e => e.engine).filter(Boolean);
    const verdictLabel = (summary.label_de || '').trim() || VERDICT_CONFIG[verdictKey].label;
    return { verdictKey, verdictLabel, aiPercent, confidenceLabel, confidence01: summary.confidence01 ?? null, reasons, warnings, engines, sources, details, meta: data.meta, usage: data.usage };
  }
  const legacy = data as { fake?: number; confidence?: 'high' | 'medium' | 'low'; user_summary?: string[]; message?: string; warnings?: string[]; sources_used?: string[]; primary_source?: string; usage?: PublicResultUsage };
  const fakeRaw = typeof legacy.fake === 'number' ? legacy.fake : Number(legacy.fake || 0);
  const fake = Number.isFinite(fakeRaw) ? fakeRaw : 0;
  const conf = String(legacy.confidence || '').toLowerCase();
  const verdictKey: VerdictKey = (fake >= 70 && conf !== 'low') ? 'likely_ai' : ((100 - fake) >= 70 && conf !== 'low') ? 'likely_real' : 'uncertain';
  const reasons = Array.isArray(legacy.user_summary) && legacy.user_summary.length ? legacy.user_summary : legacy.message ? [legacy.message] : [];
  const warnings = Array.isArray(legacy.warnings) ? legacy.warnings.filter(Boolean) : [];
  const src = Array.isArray(legacy.sources_used) ? legacy.sources_used.filter(Boolean) : [];
  const aiPercent = Number.isFinite(fake) ? Math.max(0, Math.min(100, fake)) : null;
  return { verdictKey, verdictLabel: VERDICT_CONFIG[verdictKey].label, aiPercent, confidenceLabel: legacy.confidence || 'low', reasons, warnings, engines: [], sources: src.length ? src : legacy.primary_source ? [legacy.primary_source] : [], usage: legacy.usage };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${Math.round(v)}%`;
}

function fmtMs(v: number | null | undefined) {
  const ms = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildCopyText(n: NormalizedAnalysis, title?: string): string {
  const lines = [
    'AIRealCheck – Analyseergebnis',
    `Datei: ${title || '—'}`,
    `Urteil: ${n.verdictLabel}`,
    `KI-Wahrscheinlichkeit: ${n.aiPercent !== null ? Math.round(n.aiPercent) + '%' : '—'}`,
    `Sicherheit: ${CONF_LABELS[n.confidenceLabel] ?? n.confidenceLabel}`,
  ];
  if (n.reasons.length) lines.push('', 'Gründe:', ...n.reasons.slice(0, 3).map(r => `• ${r}`));
  if (n.warnings.length) lines.push('', 'Hinweise:', ...n.warnings.slice(0, 3).map(w => `⚠ ${w}`));
  lines.push('', '— Erstellt mit AIRealCheck');
  return lines.join('\n');
}

function triggerReportDownload(n: NormalizedAnalysis, title?: string) {
  const lines = [
    'AIRealCheck – Analysebericht',
    '════════════════════════════════',
    '',
    `Datei:          ${title || '—'}`,
    `Datum:          ${n.meta?.created_at ? formatDate(n.meta.created_at) : new Date().toLocaleDateString('de-DE')}`,
    `Analyse-ID:     ${n.meta?.analysis_id || '—'}`,
    `Medientyp:      ${n.meta?.media_type || '—'}`,
    '',
    'ERGEBNIS',
    '────────────────────────────────',
    `Urteil:              ${n.verdictLabel}`,
    `KI-Wahrscheinlichkeit: ${n.aiPercent !== null ? Math.round(n.aiPercent) + '%' : '—'}`,
    `Sicherheit:          ${CONF_LABELS[n.confidenceLabel] ?? n.confidenceLabel}`,
    '',
  ];
  if (n.reasons.length) { lines.push('GRÜNDE', '────────────────────────────────'); n.reasons.forEach(r => lines.push(`• ${r}`)); lines.push(''); }
  if (n.warnings.length) { lines.push('HINWEISE', '────────────────────────────────'); n.warnings.forEach(w => lines.push(`⚠ ${w}`)); lines.push(''); }
  if (n.engines.length) {
    lines.push('ENGINE-DETAILS', '────────────────────────────────');
    n.engines.forEach(e => {
      const ai = typeof e.ai_percent === 'number' ? Math.round(e.ai_percent) + '%' : '—';
      lines.push(`${e.engine}: KI ${ai}  Laufzeit: ${fmtMs(e.timing_ms)}`);
    });
    lines.push('');
  }
  lines.push('════════════════════════════════', 'Erstellt mit AIRealCheck');
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `airealcheck-${Date.now()}.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ percent, color, size = 96 }: { percent: number; color: string; size?: number }) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, percent)) / 100);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--color-surface-3)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.span
          className="text-[22px] font-bold leading-none tabular-nums"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {Math.round(percent)}
        </motion.span>
        <span className="text-[9px] text-[var(--color-muted-2)] mt-0.5 uppercase tracking-wider">%</span>
      </div>
    </div>
  );
}

// ── Media Preview ─────────────────────────────────────────────────────────────

function MediaPreview({ file, mediaType }: { file: File; mediaType: MediaType }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [videoThumb, setVideoThumb] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  useEffect(() => {
    if (mediaType === 'image') {
      const url = URL.createObjectURL(file);
      setImgSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    if (mediaType === 'video') {
      const url = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.preload = 'metadata'; vid.muted = true; vid.src = url;
      vid.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(vid.videoWidth, 320);
        canvas.height = Math.round(canvas.width * vid.videoHeight / (vid.videoWidth || 1));
        canvas.getContext('2d')?.drawImage(vid, 0, 0, canvas.width, canvas.height);
        setVideoThumb(canvas.toDataURL('image/jpeg', 0.75));
        URL.revokeObjectURL(url);
      };
      vid.onerror = () => URL.revokeObjectURL(url);
      vid.onloadedmetadata = () => { vid.currentTime = Math.min(1, vid.duration * 0.1); };
      return () => { if (!videoThumb) URL.revokeObjectURL(url); };
    }
    if (mediaType === 'audio') {
      const url = URL.createObjectURL(file);
      const audio = document.createElement('audio');
      audio.preload = 'metadata'; audio.src = url;
      audio.onloadedmetadata = () => { setAudioDuration(audio.duration); URL.revokeObjectURL(url); };
      audio.onerror = () => URL.revokeObjectURL(url);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mediaType === 'image' && imgSrc) {
    return (
      <div className="flex-shrink-0 w-[80px] h-[80px] rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc} alt={file.name} className="w-full h-full object-cover" />
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className="flex-shrink-0 w-[80px] h-[80px] rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center">
        {videoThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={videoThumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <Video size={24} className="text-[var(--color-muted-2)]" />
        )}
      </div>
    );
  }

  if (mediaType === 'audio') {
    return (
      <div className="flex-shrink-0 w-[80px] h-[80px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col items-center justify-center gap-1">
        <Music size={20} className="text-[var(--color-muted-2)]" />
        {audioDuration !== null && (
          <span className="text-[10px] text-[var(--color-muted-2)]">{fmtDuration(audioDuration)}</span>
        )}
      </div>
    );
  }

  return null;
}

// ── Engine Bar ────────────────────────────────────────────────────────────────

function EngineBar({ engine }: { engine: PublicResultEngineEntry }) {
  const available = engine.available !== false;
  const statusRaw = String(engine.status || '').toLowerCase();
  const aiPercent = typeof engine.ai_percent === 'number' ? engine.ai_percent
    : typeof engine.ai01 === 'number' ? engine.ai01 * 100 : null;
  const confPercent = typeof engine.confidence01 === 'number' ? engine.confidence01 * 100 : null;

  let statusLabel = 'OK';
  let statusClass = 'text-[var(--color-success)]';
  if (!available) { statusLabel = 'N/V'; statusClass = 'text-[var(--color-muted-2)]'; }
  else if (statusRaw && statusRaw !== 'ok') { statusLabel = 'Gestört'; statusClass = 'text-[var(--color-warning)]'; }

  const barColor = aiPercent === null ? 'var(--color-muted-2)'
    : aiPercent >= 70 ? 'var(--color-danger)'
    : aiPercent <= 30 ? 'var(--color-success)'
    : 'var(--color-warning)';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-[var(--color-text)] capitalize">{engine.engine}</span>
          <span className={`text-[10px] ${statusClass}`}>{statusLabel}</span>
          {engine.timing_ms && (
            <span className="text-[10px] text-[var(--color-muted-2)]">{fmtMs(engine.timing_ms)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {confPercent !== null && (
            <span className="text-[10px] text-[var(--color-muted-2)]">Konf. {fmt(confPercent)}</span>
          )}
          <span className="text-[12px] font-semibold" style={{ color: barColor }}>
            {aiPercent !== null ? fmt(aiPercent) : '—'}
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={{ width: aiPercent !== null ? `${Math.max(0, Math.min(100, aiPercent))}%` : '0%' }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
        />
      </div>
      {(engine.warning || engine.notes) && (
        <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5">{engine.warning || engine.notes}</div>
      )}
    </div>
  );
}

// ── Section Wrapper ───────────────────────────────────────────────────────────

function Section({ label, children, icon: Icon, collapsible = false, defaultOpen = true }: {
  label: string;
  children: React.ReactNode;
  icon: React.ElementType;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
    >
      <button
        onClick={() => collapsible && setOpen(v => !v)}
        className={`flex items-center justify-between w-full px-5 py-4 ${collapsible ? 'cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon size={14} className="text-[var(--color-muted)]" />
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{label}</span>
        </div>
        {collapsible && (open ? <ChevronUp size={14} className="text-[var(--color-muted-2)]" /> : <ChevronDown size={14} className="text-[var(--color-muted-2)]" />)}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-[var(--color-border)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── ResultCard (main export) ──────────────────────────────────────────────────

export function ResultCard({ data, file, mediaType: mediaTypeProp, title, onReset }: ResultCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const n = normalizeAnalysisResult(data);
  const cfg = VERDICT_CONFIG[n.verdictKey];
  const VIcon = cfg.icon;
  const confInfo = CONF_INFO[n.confidenceLabel] ?? CONF_INFO.low;
  const aiPercentRounded = n.aiPercent !== null ? Math.round(n.aiPercent) : null;

  const resolvedMediaType: MediaType | undefined = mediaTypeProp ?? n.meta?.media_type ?? undefined;
  const fileName = title ?? (file?.name) ?? n.meta?.analysis_id?.slice(0, 8);
  const creditsUsed = typeof n.usage?.credits_used === 'number' ? n.usage.credits_used : null;
  const creditsLeft = typeof n.usage?.credits_left === 'number' ? n.usage.credits_left : null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildCopyText(n, fileName));
      setCopied(true);
      toast.success('Ergebnis kopiert');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  }

  function handleDownload() {
    triggerReportDownload(n, fileName);
    toast.success('Bericht wird heruntergeladen');
  }

  return (
    <div className="space-y-3">

      {/* ── Hero Card ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-[var(--radius-xl)] border p-6"
        style={{ background: cfg.bg, borderColor: cfg.color + '38' }}
      >
        <div className="flex items-start gap-5 flex-wrap sm:flex-nowrap">
          {/* Score ring */}
          {aiPercentRounded !== null ? (
            <ScoreRing percent={aiPercentRounded} color={cfg.colorRaw} size={96} />
          ) : (
            <div className="w-24 h-24 rounded-full border-[7px] border-[var(--color-surface-3)] flex items-center justify-center flex-shrink-0">
              <VIcon size={28} style={{ color: cfg.color }} />
            </div>
          )}

          {/* Verdict text */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <VIcon size={18} style={{ color: cfg.color }} />
              <motion.h2
                className="text-[18px] font-bold leading-tight"
                style={{ color: cfg.color }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                {n.verdictLabel}
              </motion.h2>
            </div>
            <motion.p
              className="text-[13px] text-[var(--color-muted)] mb-3 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              {cfg.desc}
            </motion.p>

            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap text-[12px] text-[var(--color-muted)]">
              {aiPercentRounded !== null && (
                <span className="font-semibold" style={{ color: cfg.color }}>{aiPercentRounded}% KI</span>
              )}
              <span>Sicherheit: <strong className="text-[var(--color-text)]">{confInfo.label}</strong></span>
              {resolvedMediaType && (
                <span className="capitalize">{resolvedMediaType === 'image' ? 'Bild' : resolvedMediaType === 'video' ? 'Video' : 'Audio'}</span>
              )}
              {file && <span>{fmtSize(file.size)}</span>}
              {fileName && <span className="truncate max-w-[180px] text-[var(--color-muted-2)]">{fileName}</span>}
              {n.meta?.created_at && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {formatDate(n.meta.created_at)}
                </span>
              )}
              {creditsUsed !== null && (
                <span>{creditsUsed} Credits</span>
              )}
            </div>

            {/* Analysis ID */}
            {n.meta?.analysis_id && (
              <div className="mt-2">
                <span className="text-[10px] text-[var(--color-muted-2)] font-mono select-all">
                  ID: {n.meta.analysis_id}
                </span>
              </div>
            )}
          </div>

          {/* Media preview */}
          {file && resolvedMediaType && (
            <MediaPreview file={file} mediaType={resolvedMediaType} />
          )}
        </div>

        {/* Credits left strip */}
        {creditsLeft !== null && (
          <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
            <span className="text-[12px] text-[var(--color-muted)]">{creditsLeft} Credits verbleibend</span>
          </div>
        )}
      </motion.div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 flex-wrap"
      >
        <button onClick={handleCopy}
          className="flex items-center gap-1.5 h-8 px-3.5 rounded-[var(--radius-md)] text-[12px] font-medium bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors">
          {copied ? <Check size={13} className="text-[var(--color-success)]" /> : <Copy size={13} />}
          {copied ? 'Kopiert' : 'Ergebnis kopieren'}
        </button>
        <button onClick={handleDownload}
          className="flex items-center gap-1.5 h-8 px-3.5 rounded-[var(--radius-md)] text-[12px] font-medium bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors">
          <Download size={13} />
          Bericht laden
        </button>
        <button onClick={() => router.push('/history')}
          className="flex items-center gap-1.5 h-8 px-3.5 rounded-[var(--radius-md)] text-[12px] font-medium bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors">
          <History size={13} />
          Verlauf
        </button>
        {onReset && (
          <button onClick={onReset}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-[var(--radius-md)] text-[12px] font-medium text-white transition-opacity"
            style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)' }}>
            <Plus size={13} />
            Neue Analyse
          </button>
        )}
      </motion.div>

      {/* ── Confidence Explanation ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] px-5 py-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: confInfo.color + '18', border: `1px solid ${confInfo.color}30` }}>
            <span className="text-[11px] font-bold" style={{ color: confInfo.color }}>
              {n.confidenceLabel === 'high' ? 'H' : n.confidenceLabel === 'medium' ? 'M' : 'N'}
            </span>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[var(--color-text)]" style={{ color: confInfo.color }}>
              {confInfo.label}
            </div>
            <div className="text-[12px] text-[var(--color-muted)] mt-0.5 leading-relaxed">{confInfo.desc}</div>
          </div>
        </div>
      </motion.div>

      {/* ── Engine Breakdown ──────────────────────────────────────────────── */}
      {n.engines.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Section label="Engine-Analyse" icon={Cpu} collapsible defaultOpen>
            <div className="space-y-4">
              {n.engines.map((e, i) => <EngineBar key={`${e.engine}-${i}`} engine={e} />)}
            </div>
            {n.details?.decision_threshold !== undefined && n.details.decision_threshold !== null && (
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[12px] text-[var(--color-muted)]">
                Entscheidungsschwelle: <strong className="text-[var(--color-text)]">{Math.round(n.details.decision_threshold * 100)}%</strong>
              </div>
            )}
          </Section>
        </motion.div>
      )}

      {/* Fallback: engine names from legacy format */}
      {n.engines.length === 0 && n.sources.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Section label="Verwendete Engines" icon={Cpu}>
            <div className="flex flex-wrap gap-1.5">
              {n.sources.map(s => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-muted)]">{s}</span>
              ))}
            </div>
          </Section>
        </motion.div>
      )}

      {/* ── Technical Signals ─────────────────────────────────────────────── */}
      {n.reasons.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Section label="Technische Signale" icon={Cpu}>
            <ul className="space-y-2">
              {n.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--color-muted)] leading-relaxed">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-muted-2)] mt-1.5" />
                  {r}
                </li>
              ))}
            </ul>
            {/* Additional technical detail */}
            {n.details && (n.details.provenance || n.details.watermarks || n.details.forensics) && (
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-2">
                {n.details.provenance && (
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted-2)]">C2PA Herkunft</div>
                    <div className="text-[12px] text-[var(--color-text)] mt-1 font-medium">{n.details.provenance.c2pa_status || 'Unbekannt'}</div>
                    {n.details.provenance.c2pa_summary && (
                      <div className="text-[11px] text-[var(--color-muted)] mt-1">{n.details.provenance.c2pa_summary}</div>
                    )}
                  </div>
                )}
                {n.details.watermarks && (
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted-2)]">Wasserzeichen</div>
                    <div className="text-[12px] text-[var(--color-text)] mt-1 font-medium">{n.details.watermarks.status || 'Unbekannt'}</div>
                    {n.details.watermarks.summary && (
                      <div className="text-[11px] text-[var(--color-muted)] mt-1">{n.details.watermarks.summary}</div>
                    )}
                  </div>
                )}
                {n.details.forensics && (
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted-2)]">Forensik</div>
                    <div className="text-[12px] text-[var(--color-text)] mt-1 font-medium">
                      {typeof n.details.forensics.ai_percent === 'number'
                        ? `Score: ${Math.round(n.details.forensics.ai_percent)}%`
                        : (n.details.forensics.summary_lines?.[0] || 'Keine Auffälligkeiten')}
                    </div>
                  </div>
                )}
                {typeof n.confidence01 === 'number' && (
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted-2)]">Konfidenz (0–1)</div>
                    <div className="text-[12px] text-[var(--color-text)] mt-1 font-medium">{n.confidence01.toFixed(3)}</div>
                  </div>
                )}
              </div>
            )}
          </Section>
        </motion.div>
      )}

      {/* ── Warnings / Limitations ────────────────────────────────────────── */}
      {n.warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-[var(--radius-lg)] bg-[var(--color-warning-muted)] border border-[var(--color-warning)] border-opacity-30 px-5 py-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={13} className="text-[var(--color-warning)] flex-shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-warning)]">Hinweise &amp; Einschränkungen</span>
          </div>
          <ul className="space-y-2">
            {n.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--color-muted)] leading-relaxed">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] mt-1.5" />
                {w}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

    </div>
  );
}
