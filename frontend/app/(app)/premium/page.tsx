'use client';

import React, { useState, useEffect } from 'react';
import { CONTACT_EMAIL } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  Zap,
  Image as ImageIcon,
  Video,
  Music,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  BadgeCheck,
  Clock,
  RefreshCw,
  Info,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  PLANS,
  PLAN_ORDER,
  CREDIT_COSTS,
  getPlan,
  isPaidPlan,
  imagesPerMonth,
  videoMinutesPerMonth,
  fetchPlansFromApi,
  getNextPlanId,
  type Plan,
  type PlanId,
} from '@/lib/plans';
import { API_BASE } from '@/lib/api';

// ─── Dynamic plan loader (P1.6) ───────────────────────────────────────────────

function usePlans() {
  const staticPlans = PLAN_ORDER.map(id => PLANS[id]);
  const [plans, setPlans] = useState<Plan[]>(staticPlans);
  const [planOrder, setPlanOrder] = useState<string[]>(PLAN_ORDER);

  useEffect(() => {
    fetchPlansFromApi(API_BASE).then(fetched => {
      if (fetched && fetched.length > 0) {
        setPlans(fetched);
        setPlanOrder(fetched.map(p => p.id));
      }
    });
  }, []);

  return { plans, planOrder };
}

// ─── Feature comparison rows ──────────────────────────────────────────────────

interface CompRow {
  label: string;
  free: React.ReactNode;
  pro: React.ReactNode;
  business: React.ReactNode;
}

const CHECK = (color = '#22d3ee') => <Check size={15} style={{ color }} />;
const CROSS = () => <X size={15} className="text-[var(--color-muted-2)]" />;
const TEXT = (t: string) => <span className="text-[12px] font-medium text-[var(--color-text)]">{t}</span>;

const COMP_ROWS: CompRow[] = [
  { label: 'Credits / Monat',      free: TEXT('100'),      pro: TEXT('1.500'),      business: TEXT('10.000') },
  { label: 'Bildanalyse',          free: CHECK(),          pro: CHECK(),            business: CHECK() },
  { label: 'Audioanalyse',         free: CHECK(),          pro: CHECK(),            business: CHECK() },
  { label: 'Videoanalyse',         free: CHECK(),          pro: CHECK(),            business: CHECK() },
  { label: 'Analyse-Verlauf',      free: TEXT('30 Tage'),  pro: TEXT('Unbegrenzt'), business: TEXT('Unbegrenzt') },
  { label: 'Priorisierte Engines', free: CROSS(),          pro: CHECK(),            business: CHECK() },
  { label: 'API-Zugang',           free: CROSS(),          pro: TEXT('Beta'),       business: TEXT('Voll + höheres Limit') },
  { label: 'Webhooks',             free: CROSS(),          pro: CROSS(),            business: CHECK('#a78bfa') },
  { label: 'Premium-Engines',      free: CROSS(),          pro: CROSS(),            business: CHECK('#a78bfa') },
  { label: 'Support',              free: TEXT('E-Mail'),   pro: TEXT('Priorität'),  business: TEXT('Dedizierter Kanal') },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Wann werden Pro und Business verfügbar sein?',
    a: `Die Checkout-Integration wird gerade fertiggestellt. Du kannst dich auf die Warteliste eintragen oder uns unter ${CONTACT_EMAIL} kontaktieren — wir benachrichtigen dich bei Launch.`,
  },
  {
    q: 'Was passiert mit meinen Credits am Monatsende?',
    a: 'Credits werden monatlich zurückgesetzt — nicht verbrauchte Credits verfallen. Credits werden pro Analyse abgezogen; bei einem Fehler der Analyse werden keine Credits abgezogen.',
  },
  {
    q: 'Wie genau funktioniert die Credit-Berechnung?',
    a: 'Bilder: 15 Credits pro Datei. Audio: 20 Credits pro Analyse. Video: 30 Credits pro Analyse (kurze Videos bis 30 Sek.). Das Ergebnis wird immer vollständig zurückgegeben — auch wenn die Credits danach auf 0 stehen.',
  },
  {
    q: 'Kann ich upgraden und danach wieder downgraden?',
    a: 'Ja. Ein Downgrade auf Free ist jederzeit möglich. Nicht genutzte Credits des bezahlten Plans werden nicht erstattet. Beim Downgrade bleiben deine Analysedaten erhalten.',
  },
  {
    q: 'Gibt es einen Rabatt bei jährlicher Zahlung?',
    a: 'Jahresrabatte sind geplant (ca. 20 % Ersparnis). Diese werden mit der Checkout-Integration verfügbar sein.',
  },
  {
    q: 'Wie sicher sind meine Zahlungsdaten?',
    a: 'Zahlungen werden über Stripe abgewickelt — AIRealCheck speichert keine Kartendaten. Stripe ist PCI-DSS Level 1 zertifiziert.',
  },
  {
    q: 'Gibt es Enterprise-Konditionen?',
    a: `Ja. Für höhere Volumen, SLA-Vereinbarungen oder maßgeschneiderte Integrationen kontaktiere uns unter ${CONTACT_EMAIL}.`,
  },
];

// ─── Checkout stub CTA ────────────────────────────────────────────────────────

function UpgradeCta({ plan, currentPlanId }: { plan: Plan; currentPlanId: string }) {
  const [showStub, setShowStub] = useState(false);

  if (plan.id === 'free') {
    if (currentPlanId === 'free') {
      return (
        <div className="w-full h-10 rounded-[var(--radius-md)] flex items-center justify-center text-[13px] font-medium bg-[var(--color-surface-2)] text-[var(--color-muted)] border border-[var(--color-border)] cursor-default select-none">
          <BadgeCheck size={14} className="mr-2" /> Aktueller Plan
        </div>
      );
    }
    return null;
  }

  if (currentPlanId === plan.id) {
    return (
      <div className="w-full h-10 rounded-[var(--radius-md)] flex items-center justify-center text-[13px] font-medium border"
        style={{ borderColor: plan.color, color: plan.color, background: plan.color + '12' }}>
        <BadgeCheck size={14} className="mr-2" /> Aktueller Plan
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowStub(v => !v)}
        className="w-full h-10 rounded-[var(--radius-md)] text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
        style={{ background: plan.highlighted ? 'linear-gradient(135deg, #22d3ee, #7c3aed)' : plan.color }}
      >
        {plan.highlighted ? <Sparkles size={14} /> : <Zap size={14} />}
        {isPaidPlan(currentPlanId) ? `Wechsel zu ${plan.name}` : `Zu ${plan.name} upgraden`}
      </button>
      <AnimatePresence>
        {showStub && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-md)] border text-[12px]"
              style={{ background: plan.color + '10', borderColor: plan.color + '40' }}>
              <Clock size={12} style={{ color: plan.color }} className="flex-shrink-0 mt-0.5" />
              <div style={{ color: 'var(--color-muted)' }}>
                Checkout wird implementiert. Für frühen Zugang:{' '}
                <a href={`mailto:${CONTACT_EMAIL}?subject=${plan.name}-Zugang`}
                  className="font-semibold hover:underline" style={{ color: plan.color }}>
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Pricing card (P1.2 + P1.3 + P1.4 + P1.5) ────────────────────────────────

function PricingCard({ plan, currentPlanId, delay }: { plan: Plan; currentPlanId: string; delay: number }) {
  const isCurrent = currentPlanId === plan.id;

  return (
    <motion.div
      data-plan={plan.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={`relative flex flex-col rounded-[var(--radius-xl)] border overflow-hidden transition-all ${
        plan.highlighted
          ? 'shadow-[0_0_0_2px] shadow-[#22d3ee]'
          : 'border-[var(--color-border)]'
      }`}
      style={{
        background: plan.highlighted
          ? 'linear-gradient(160deg, #22d3ee08, #7c3aed08)'
          : 'var(--color-surface)',
      }}
    >
      {/* Highlighted top border */}
      {plan.highlighted && (
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, #22d3ee, #7c3aed)' }} />
      )}

      {/* P1.3 – Social Proof Badge (dynamic badgeText) */}
      {plan.badgeText && (
        <div className="absolute top-3 right-3">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white"
            style={{ background: plan.highlighted ? 'linear-gradient(135deg, #22d3ee, #7c3aed)' : plan.color }}
          >
            <Sparkles size={9} /> {plan.badgeText}
          </span>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col">
        {/* Plan header */}
        <div className="mb-5">
          <div className="text-[13px] font-semibold mb-2" style={{ color: plan.color }}>{plan.name}</div>

          {/* P1.2 – Anchoring: original price crossed out, current price prominent */}
          <div className="flex items-end gap-2 flex-wrap">
            {plan.originalPrice != null && plan.originalPrice > plan.priceMonthly && (
              <span className="text-[20px] font-semibold text-[var(--color-muted-2)] line-through leading-none self-center">
                {plan.originalPrice} €
              </span>
            )}
            <span className="text-[36px] font-bold text-[var(--color-text)] leading-none">
              {plan.priceMonthly === 0 ? 'Kostenlos' : `${plan.priceMonthly} €`}
            </span>
            {plan.priceMonthly > 0 && (
              <span className="text-[13px] text-[var(--color-muted)] pb-1">/Monat</span>
            )}
          </div>

          {/* P1.4 – Loss Aversion: savings label */}
          {plan.savingsLabel && (
            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: plan.color + '20', color: plan.color }}>
              <TrendingDown size={10} /> {plan.savingsLabel}
            </div>
          )}

          <div className="text-[12px] text-[var(--color-muted)] mt-2">
            <span className="font-semibold text-[var(--color-text)]">{plan.creditsMonthly.toLocaleString('de-DE')}</span> Credits / Monat
          </div>
        </div>

        {/* Feature list */}
        <ul className="space-y-2 mb-6 flex-1">
          {plan.features.map(f => (
            <li key={f} className="flex items-start gap-2.5 text-[12px] text-[var(--color-muted)]">
              <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: plan.color }} />
              {f}
            </li>
          ))}
          {plan.limitations?.map(f => (
            <li key={f} className="flex items-start gap-2.5 text-[12px] text-[var(--color-muted-2)]">
              <X size={13} className="mt-0.5 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <UpgradeCta plan={plan} currentPlanId={currentPlanId} />
      </div>
    </motion.div>
  );
}

// ─── Credit model section ─────────────────────────────────────────────────────

function CreditModel() {
  const items = [
    { icon: ImageIcon, label: 'Bild',  cost: `${CREDIT_COSTS.image} Credits`, sub: 'pro Datei',               color: '#22d3ee' },
    { icon: Music,     label: 'Audio', cost: `${CREDIT_COSTS.audio} Credits`, sub: 'pro begonnener Minute',    color: '#34d399' },
    { icon: Video,     label: 'Video', cost: `${CREDIT_COSTS.video} Credits`, sub: 'pro begonnener Minute',    color: '#a78bfa' },
  ];

  return (
    <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--color-border)]">
        <div className="text-[14px] font-semibold text-[var(--color-text)]">Credit-Modell</div>
        <div className="text-[12px] text-[var(--color-muted)] mt-0.5">So werden Credits pro Analyse verbraucht</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)]">
        {items.map(({ icon: Icon, label, cost, sub, color }) => (
          <div key={label} className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-[var(--radius-lg)] flex items-center justify-center flex-shrink-0"
              style={{ background: color + '20' }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div className="text-[11px] text-[var(--color-muted)] mb-0.5">{label}</div>
              <div className="text-[16px] font-bold text-[var(--color-text)]">{cost}</div>
              <div className="text-[11px] text-[var(--color-muted-2)]">{sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-6 py-3.5 border-t border-[var(--color-border)] flex items-start gap-2 text-[12px] text-[var(--color-muted)]">
        <Info size={13} className="flex-shrink-0 mt-0.5" />
        <span>Bei einem Analysefehler werden <strong>keine Credits abgezogen</strong>. Credits werden monatlich zurückgesetzt.</span>
      </div>
    </div>
  );
}

// ─── Comparison table ─────────────────────────────────────────────────────────

function ComparisonTable({ currentPlanId }: { currentPlanId: string }) {
  const PLAN_COLORS: Record<string, string> = {
    free: 'var(--color-muted)',
    pro: '#22d3ee',
    business: '#a78bfa',
  };

  return (
    <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--color-border)]">
        <div className="text-[14px] font-semibold text-[var(--color-text)]">Alle Funktionen im Vergleich</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-2)] w-[45%]">Funktion</th>
              {PLAN_ORDER.map(pid => (
                <th key={pid} className="text-center px-4 py-3 text-[12px] font-bold"
                  style={{ color: PLAN_COLORS[pid] ?? 'var(--color-muted)' }}>
                  {PLANS[pid]?.name ?? pid}
                  {currentPlanId === pid && (
                    <span className="ml-1.5 text-[9px] font-medium text-[var(--color-muted)]">(aktuell)</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMP_ROWS.map((row, i) => (
              <tr key={i} className={`border-b border-[var(--color-border)] last:border-0 ${i % 2 === 0 ? '' : 'bg-[var(--color-surface-2)]/40'}`}>
                <td className="px-5 py-3 text-[12px] text-[var(--color-muted)]">{row.label}</td>
                <td className="px-4 py-3 text-center">{row.free}</td>
                <td className="px-4 py-3 text-center">{row.pro}</td>
                <td className="px-4 py-3 text-center">{row.business}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-muted-2)] mb-4">Häufige Fragen</div>
      <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden divide-y divide-[var(--color-border)]">
        {FAQS.map((faq, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-start justify-between gap-4 px-6 py-4 text-left hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <span className="text-[13px] font-medium text-[var(--color-text)]">{faq.q}</span>
              {open === i
                ? <ChevronUp size={15} className="text-[var(--color-muted)] flex-shrink-0 mt-0.5" />
                : <ChevronDown size={15} className="text-[var(--color-muted)] flex-shrink-0 mt-0.5" />}
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-4 text-[13px] text-[var(--color-muted)] leading-relaxed border-t border-[var(--color-border)]">
                    <div className="pt-3">{faq.a}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PremiumPage() {
  const router = useRouter();
  const { user, balance, isLoggedIn } = useAuth();
  const { plans, planOrder } = usePlans();

  const currentPlanId = (balance?.plan_type ?? user?.plan_type ?? 'free') as string;
  const currentPlan = getPlan(currentPlanId);
  const alreadyPaid = isPaidPlan(currentPlanId);
  const creditsAvail = balance?.credits_available ?? 0;
  const creditsTotal = balance?.credits_total ?? 100;

  // Mid-page CTA: show when not on the highest plan, with dynamic next-plan label
  const nextPlanId = getNextPlanId(currentPlanId, planOrder);
  const nextPlan = nextPlanId ? plans.find(p => p.id === nextPlanId) : null;

  return (
    <div className="max-w-4xl mx-auto px-5 py-10 space-y-10">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="text-center space-y-4 py-4"
      >
        {/* Plan-aware status badge */}
        {isLoggedIn && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border mb-2"
            style={{
              background: alreadyPaid ? '#a78bfa15' : 'var(--color-surface-2)',
              borderColor: alreadyPaid ? '#a78bfa50' : 'var(--color-border)',
              color: alreadyPaid ? '#a78bfa' : 'var(--color-muted)',
            }}
          >
            {alreadyPaid ? <Sparkles size={11} /> : <RefreshCw size={11} />}
            Aktuell: <strong>{currentPlan.name}</strong>
            {alreadyPaid && ` · ${creditsAvail.toLocaleString('de-DE')} / ${creditsTotal.toLocaleString('de-DE')} Credits`}
          </div>
        )}

        <h1 className="text-[34px] sm:text-[42px] font-bold leading-tight">
          <span className="text-[var(--color-text)]">KI erkennen</span>{' '}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #22d3ee 20%, #7c3aed 80%)' }}
          >
            ohne Kompromisse
          </span>
        </h1>
        <p className="text-[15px] text-[var(--color-muted)] max-w-xl mx-auto leading-relaxed">
          Wähle den Plan, der zu dir passt. Alle Pläne beinhalten Bild-, Audio- und Videoanalyse mit mehreren KI-Engines gleichzeitig.
        </p>

        {!isLoggedIn && (
          <button
            onClick={() => router.push('/register')}
            className="inline-flex items-center gap-2 h-11 px-7 text-[14px] font-semibold text-white rounded-[var(--radius-xl)] transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #22d3ee, #7c3aed)' }}
          >
            <Sparkles size={15} /> Kostenlos starten <ArrowRight size={14} />
          </button>
        )}
      </motion.div>

      {/* ── Pricing cards (P1.5 – dynamic, works for any number of plans) ── */}
      <div className={`grid gap-5 grid-cols-1 ${plans.length === 2 ? 'sm:grid-cols-2' : plans.length >= 3 ? 'sm:grid-cols-3' : ''}`}>
        {plans.map((plan, i) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            currentPlanId={currentPlanId}
            delay={0.05 + i * 0.07}
          />
        ))}
      </div>

      {/* ── Credit model ────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.35 }}>
        <div className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-muted-2)] mb-4">Credit-Kosten</div>
        <CreditModel />
      </motion.div>

      {/* ── Credit calculator hint ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35 }}
        className={`grid gap-4 grid-cols-1 ${plans.length >= 3 ? 'sm:grid-cols-3' : plans.length === 2 ? 'sm:grid-cols-2' : ''}`}
      >
        {plans.map(p => (
          <div key={p.id} className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] p-4 text-center space-y-1">
            <div className="text-[12px] font-semibold" style={{ color: p.color }}>{p.name}</div>
            <div className="text-[13px] text-[var(--color-muted)]">
              ≈ <span className="font-bold text-[var(--color-text)]">{imagesPerMonth(p).toLocaleString('de-DE')}</span> Bilder
            </div>
            <div className="text-[13px] text-[var(--color-muted)]">
              oder ≈ <span className="font-bold text-[var(--color-text)]">{videoMinutesPerMonth(p).toLocaleString('de-DE')}</span> Min. Video
            </div>
            <div className="text-[11px] text-[var(--color-muted-2)]">pro Monat</div>
          </div>
        ))}
      </motion.div>

      {/* ── Feature comparison table ─────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.35 }}>
        <div className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-muted-2)] mb-4">Funktionsvergleich</div>
        <ComparisonTable currentPlanId={currentPlanId} />
      </motion.div>

      {/* ── Mid-page CTA (dynamic next plan, hidden for top-tier users) ──────── */}
      {nextPlan && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.35 }}
          className="rounded-[var(--radius-xl)] p-6 flex flex-col sm:flex-row items-center justify-between gap-5"
          style={{ background: 'linear-gradient(135deg, #22d3ee12, #7c3aed12)', border: '1px solid #22d3ee30' }}
        >
          <div>
            <div className="text-[16px] font-bold text-[var(--color-text)]">
              Bereit für mehr Analysen?
            </div>
            <div className="text-[13px] text-[var(--color-muted)] mt-1">
              {nextPlan.name} gibt dir {nextPlan.creditsMonthly.toLocaleString('de-DE')} Credits — das entspricht
              ≈ {imagesPerMonth(nextPlan).toLocaleString('de-DE')} Bilder oder{' '}
              ≈ {videoMinutesPerMonth(nextPlan).toLocaleString('de-DE')} Min. Video pro Monat.
              {nextPlan.savingsLabel && (
                <span className="ml-1.5 font-semibold" style={{ color: nextPlan.color }}>{nextPlan.savingsLabel}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              document.querySelector(`[data-plan="${nextPlan.id}"]`)?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex-shrink-0 flex items-center gap-2 h-10 px-6 text-[13px] font-semibold text-white rounded-[var(--radius-lg)] transition-all hover:opacity-90 whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg, #22d3ee, #7c3aed)' }}
          >
            <Sparkles size={14} /> {nextPlan.name} ansehen
          </button>
        </motion.div>
      )}

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.35 }}>
        <FaqSection />
      </motion.div>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.35 }}
        className="text-center py-4 space-y-3"
      >
        <div className="text-[14px] text-[var(--color-muted)]">
          Fragen zu Plänen, Enterprise oder individuellen Anforderungen?
        </div>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex items-center gap-2 text-[13px] font-semibold hover:underline"
          style={{ color: '#22d3ee' }}
        >
          {CONTACT_EMAIL} <ArrowRight size={13} />
        </a>
      </motion.div>

    </div>
  );
}
