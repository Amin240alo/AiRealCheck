/**
 * AIRealCheck plan constants and credit model.
 * Single source of truth for pricing, features, and credit costs.
 */

// ─── Credit costs per media type ─────────────────────────────────────────────

export const CREDIT_COSTS = {
  /** Credits per image file */
  image: 15,
  /** Credits per audio file */
  audio: 20,
  /** Credits per video analysis (short/default) */
  video: 30,
} as const;

// ─── Plan definitions ─────────────────────────────────────────────────────────

export type PlanId = 'free' | 'pro' | 'business';

export interface Plan {
  id: PlanId;
  name: string;
  nameShort: string;
  priceMonthly: number;       // EUR per month, 0 = free
  originalPrice?: number;     // P1.2 Anchoring – old/higher price shown crossed-out
  savingsLabel?: string;      // P1.4 Loss Aversion – e.g. "Spare 51 %"
  badgeText?: string;         // P1.3 Social Proof – e.g. "Beliebtester Plan"
  creditsMonthly: number;     // credits included per billing period
  highlighted: boolean;       // true = featured/recommended card
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
      'Bildanalyse (15 Credits / Datei)',
      'Audioanalyse (20 Credits / Datei)',
      'Videoanalyse (30 Credits / Datei)',
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
    originalPrice: 39,
    savingsLabel: 'Spare 51 %',
    badgeText: 'Beliebtester Plan',
    creditsMonthly: 1500,
    highlighted: true,
    checkoutAvailable: false, // flip to true once Stripe/payment is wired
    color: '#22d3ee',
    features: [
      '1.500 Credits pro Monat',
      'Bildanalyse (15 Credits / Datei)',
      'Audioanalyse (20 Credits / Datei)',
      'Videoanalyse (30 Credits / Datei)',
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
    originalPrice: 129,
    savingsLabel: 'Spare 39 %',
    badgeText: 'Best Value',
    creditsMonthly: 10000,
    highlighted: false,
    checkoutAvailable: false,
    color: '#a78bfa',
    features: [
      '10.000 Credits pro Monat',
      'Bildanalyse (15 Credits / Datei)',
      'Audioanalyse (20 Credits / Datei)',
      'Videoanalyse (30 Credits / Datei)',
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

// ─── Backend-dynamic plan loading (P1.6) ─────────────────────────────────────

/** Shape returned by GET /api/plans (snake_case from Flask). */
interface ApiPlan {
  id: string;
  name: string;
  price_monthly: number;
  original_price?: number | null;
  savings_label?: string | null;
  badge_text?: string | null;
  credits_monthly: number;
  highlighted: boolean;
  checkout_available: boolean;
  color: string;
  features: string[];
  limitations?: string[] | null;
}

/** Fetch plans from the backend; resolves to null on any error (caller uses static fallback). */
export async function fetchPlansFromApi(apiBase: string): Promise<Plan[] | null> {
  try {
    const res = await fetch(`${apiBase}/api/plans`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.plans)) return null;
    return (data.plans as ApiPlan[]).map(p => ({
      id: p.id as PlanId,
      name: p.name,
      nameShort: p.name,
      priceMonthly: p.price_monthly,
      originalPrice: p.original_price ?? undefined,
      savingsLabel: p.savings_label ?? undefined,
      badgeText: p.badge_text ?? undefined,
      creditsMonthly: p.credits_monthly,
      highlighted: p.highlighted,
      checkoutAvailable: p.checkout_available,
      color: p.color,
      features: p.features,
      limitations: p.limitations ?? undefined,
    }));
  } catch {
    return null;
  }
}

/**
 * Returns the "next upgrade" plan id for a given current plan id.
 * Returns null if the user is already on the highest tier.
 */
export function getNextPlanId(currentPlanId: string, orderedIds: string[]): string | null {
  const idx = orderedIds.indexOf(currentPlanId);
  if (idx === -1 || idx >= orderedIds.length - 1) return null;
  return orderedIds[idx + 1];
}
