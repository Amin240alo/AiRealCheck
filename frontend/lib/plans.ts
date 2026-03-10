/**
 * AIRealCheck plan constants and credit model.
 * Single source of truth for pricing, features, and credit costs.
 */

// ─── Credit costs per media type ─────────────────────────────────────────────

export const CREDIT_COSTS = {
  /** Credits per image file */
  image: 5,
  /** Credits per started minute of audio */
  audio: 10,
  /** Credits per started minute of video */
  video: 25,
} as const;

// ─── Plan definitions ─────────────────────────────────────────────────────────

export type PlanId = 'free' | 'pro' | 'business';

export interface Plan {
  id: PlanId;
  name: string;
  nameShort: string;
  priceMonthly: number;       // EUR per month, 0 = free
  creditsMonthly: number;     // credits included per billing period
  highlighted: boolean;       // true = "recommended" card
  checkoutAvailable: boolean; // false = stub / coming soon
  color: string;              // accent color for card
  features: string[];
  limitations?: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    nameShort: 'Free',
    priceMonthly: 0,
    creditsMonthly: 100,
    highlighted: false,
    checkoutAvailable: false,
    color: 'var(--color-muted)',
    features: [
      '100 Credits pro Monat',
      'Bildanalyse (5 Credits / Datei)',
      'Audioanalyse (10 Credits / Min.)',
      'Videoanalyse (25 Credits / Min.)',
      'Analyse-Verlauf (30 Tage)',
      'E-Mail-Support',
    ],
    limitations: [
      'Kein API-Zugang',
      'Standard-Engines',
      'Kein Priority-Support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    nameShort: 'Pro',
    priceMonthly: 19,
    creditsMonthly: 1500,
    highlighted: true,
    checkoutAvailable: false, // flip to true once Stripe/payment is wired
    color: '#22d3ee',
    features: [
      '1.500 Credits pro Monat',
      'Bildanalyse (5 Credits / Datei)',
      'Audioanalyse (10 Credits / Min.)',
      'Videoanalyse (25 Credits / Min.)',
      'Vollständiger Analyse-Verlauf',
      'Priorisierte Engine-Auswahl',
      'API-Zugang (Beta)',
      'Priority-E-Mail-Support',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    nameShort: 'Biz',
    priceMonthly: 79,
    creditsMonthly: 10000,
    highlighted: false,
    checkoutAvailable: false,
    color: '#a78bfa',
    features: [
      '10.000 Credits pro Monat',
      'Bildanalyse (5 Credits / Datei)',
      'Audioanalyse (10 Credits / Min.)',
      'Videoanalyse (25 Credits / Min.)',
      'Vollständiger Analyse-Verlauf',
      'Alle Engines inkl. Premium-Engines',
      'API-Zugang inkl. höherem Rate-Limit',
      'Webhook-Unterstützung',
      'Dedizierter Support-Kanal',
      'Team-Nutzung (bald)',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'business'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? 'free'] ?? PLANS.free;
}

export function isPaidPlan(id: string | null | undefined): boolean {
  return id === 'pro' || id === 'business';
}

/** How many images can a plan buy per month at full price? */
export function imagesPerMonth(plan: Plan): number {
  return Math.floor(plan.creditsMonthly / CREDIT_COSTS.image);
}

/** How many minutes of video per month? */
export function videoMinutesPerMonth(plan: Plan): number {
  return Math.floor(plan.creditsMonthly / CREDIT_COSTS.video);
}
