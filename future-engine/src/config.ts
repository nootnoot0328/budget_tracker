// Scenario configuration. Everything a user can edit lives here.
// Dates are "YYYY-MM" strings so scenarios round-trip through JSON cleanly.

export interface Grade { id: string; min: number; max: number }
export interface Promotion { id: string; ym: string; toGrade: string; amount: number }
export interface Allowance {
  id: string; label: string; from: string; to: string; // to = '' means open-ended (inclusive end month otherwise)
  amount: number; cpf: boolean; bonus: boolean; aws: boolean; grows: boolean;
}
export interface DatedAmount { id: string; from: string; to: string; monthly: number }
export interface OneOff { id: string; ym: string; amount: number; note: string }
export interface Voluntary { id: string; ym: string; account: 'SA_RA' | 'MA'; amount: number; repeatYearly: boolean; until: string }
export interface Transfer { id: string; ym: string; amount: number; repeatYearly: boolean; until: string }
export interface Bond {
  id: string; label: string; buyYM: string; face: number; pricePer100: number;
  couponPct: number; couponsPerYear: 1 | 2; maturityYM: string; marketYieldPct: number;
}

export type ReferencePeriod = 'trailing-12' | 'calendar-year' | 'prior-calendar-year';
export type BonusMethod = 'payment-month' | 'average' | 'prorated';

export interface Config {
  name: string;
  profile: { startYM: string; birthDate: string; endAge: number };
  salary: {
    startBasic: number; startGrade: string;
    incRate: number; incMonth: number; incFirstYear: number;
    order: 'increment-first' | 'promotion-first';
    sameMonthCeiling: 'new-grade' | 'sequential';
    grades: Grade[]; bandGrowth: number; promotions: Promotion[];
    adjustToMinOnPromotion: boolean;
    lumpSum: { policy: 'none' | 'blocked12' | 'custom'; customAmount: number; payMonth: number; bonusable: boolean; cpfable: boolean };
  };
  allowances: Allowance[];
  bonus: {
    employmentStart: string; prorateFirstYear: boolean;
    months: number; payMonth: number; reference: ReferencePeriod; method: BonusMethod;
    overrides: { id: string; year: number; months: number }[];
    awsEnabled: boolean; awsMonths: number; awsPayMonth: number; awsReference: ReferencePeriod; awsMethod: BonusMethod;
  };
  cpf: {
    status: 'citizen' | 'pr'; prDate: string; prScheme: 'GG' | 'FG' | 'FF';
    owCeiling: number; owCeilingFrom: string; owCeilingGrowth: number; // growth applies each Jan after owCeilingFrom's year
    annualCeiling: number; annualLimit: number;
    preStartOW: number; preStartAW: number; preStartEmployeeCPF: number; // same calendar year, before projection start
    contributionLag: number;
    startOA: number; startSA: number; startMA: number;
    oaRate: number; smraRate: number; extraInterest: boolean;
    bhs2026: number; bhsGrowth: number; frsGrowth: number; // growth applied to years after the last announced figure
    retirementTarget: 'FRS' | 'BRS';
    housing: DatedAmount[]; medical: DatedAmount[]; voluntary: Voluntary[]; transfers: Transfer[];
  };
  tax: { mode: 'estimate' | 'manual' | 'none'; manualMonthly: number; otherReliefs: number; preStartIncome: number };
  expenses: { monthly: number; inflationLinked: boolean };
  savings: {
    startCash: number; fixedMonthly: number; pctSalaryAfterCPF: number; pctBonus: number; pctLump: number;
    oneOffs: OneOff[]; leftover: 'spend' | 'sweep';
    alloc: { cash: number; fd: number; ssb: number; fund: number };
    cash: { rate: number; credit: 'monthly' | 'quarterly' | 'annual' };
    fd: { rate: number; initialMonths: number; renewRate: number; tenure: number; min: number;
      renewal: 'principal' | 'principal+interest' | 'stop'; compounding: 'simple' | 'monthly';
      penalty: 'forfeit-all' | 'forfeit-pct' | 'none'; penaltyPct: number };
    ssb: { coupons: number[]; feePerPurchase: number; limit: number };
    bonds: Bond[];
    reinvestCoupons: boolean;
    fund: { returnPct: number; feePct: number; shockYM: string; shockPct: number };
  };
  inflation: number;
}

const id = (p: string, i: number) => `${p}${i}`;

export function defaultConfig(): Config {
  return {
    name: 'Baseline',
    profile: { startYM: '2026-11', birthDate: '1995-06-15', endAge: 55 },
    salary: {
      startBasic: 4980, startGrade: 'S2', incRate: 0.04, incMonth: 11, incFirstYear: 2027,
      order: 'increment-first', sameMonthCeiling: 'new-grade',
      grades: [
        { id: 'S1', min: 3500, max: 5690 }, { id: 'S2', min: 3800, max: 7840 },
        { id: 'S3', min: 4950, max: 9540 }, { id: 'S4', min: 6210, max: 10630 },
      ],
      bandGrowth: 0,
      promotions: [
        { id: id('p', 1), ym: '2028-11', toGrade: 'S3', amount: 450 },
        { id: id('p', 2), ym: '2033-11', toGrade: 'S4', amount: 450 },
      ],
      adjustToMinOnPromotion: false,
      lumpSum: { policy: 'blocked12', customAmount: 3000, payMonth: 11, bonusable: false, cpfable: true },
    },
    allowances: [
      { id: id('a', 1), label: 'Allowance (stage 1)', from: '2027-11', to: '2032-10', amount: 400, cpf: true, bonus: true, aws: true, grows: false },
      { id: id('a', 2), label: 'Allowance (stage 2)', from: '2032-11', to: '', amount: 800, cpf: true, bonus: true, aws: true, grows: false },
    ],
    bonus: {
      employmentStart: '2026-09', prorateFirstYear: true,
      months: 4, payMonth: 3, reference: 'prior-calendar-year', method: 'payment-month', overrides: [],
      awsEnabled: true, awsMonths: 1, awsPayMonth: 12, awsReference: 'calendar-year', awsMethod: 'payment-month',
    },
    cpf: {
      status: 'citizen', prDate: '2025-01', prScheme: 'GG',
      owCeiling: 8000, owCeilingFrom: '2026-01', owCeilingGrowth: 0,
      annualCeiling: 102000, annualLimit: 37740,
      preStartOW: 49800, preStartAW: 0, preStartEmployeeCPF: 9960, contributionLag: 1,
      startOA: 0, startSA: 0, startMA: 0,
      oaRate: 0.025, smraRate: 0.04, extraInterest: true,
      bhs2026: 79000, bhsGrowth: 0.04, frsGrowth: 0.035, retirementTarget: 'FRS',
      housing: [], medical: [], voluntary: [], transfers: [],
    },
    tax: { mode: 'estimate', manualMonthly: 300, otherReliefs: 0, preStartIncome: 49800 },
    expenses: { monthly: 2000, inflationLinked: true },
    savings: {
      startCash: 0, fixedMonthly: 1000, pctSalaryAfterCPF: 0, pctBonus: 0.3, pctLump: 0.5,
      oneOffs: [], leftover: 'spend',
      alloc: { cash: 0.4, fd: 0.4, ssb: 0.2, fund: 0 },
      cash: { rate: 0.005, credit: 'monthly' },
      fd: { rate: 0.017, initialMonths: 12, renewRate: 0.015, tenure: 12, min: 5000, renewal: 'principal+interest', compounding: 'simple', penalty: 'forfeit-all', penaltyPct: 0 },
      ssb: { coupons: [1.67, 2.0, 2.19, 2.35, 2.49, 2.61, 2.7, 2.79, 2.91, 3.08], feePerPurchase: 2, limit: 200000 },
      bonds: [],
      reinvestCoupons: true,
      fund: { returnPct: 3.5, feePct: 0.3, shockYM: '', shockPct: 0 },
    },
    inflation: 0.025,
  };
}

/** Alternative scenario preset used for side-by-side comparison. */
export function alternativeConfig(): Config {
  const c = defaultConfig();
  c.name = 'Alternative';
  c.salary.incRate = 0.03;
  c.salary.lumpSum.policy = 'none';
  c.salary.promotions = c.salary.promotions.slice(0, 1);
  return c;
}

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
