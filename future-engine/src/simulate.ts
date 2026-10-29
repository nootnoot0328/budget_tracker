// Monthly, event-driven projection. Pure functions only; no UI code here.
//
// Pass 1 works out pay, CPF contributions and tax for every month. None of that depends on
//        account balances, so it can be done first (and it lets the AW ceiling use the
//        whole calendar year's OW, which is what the employer's year-end recomputation does).
// Pass 2 walks the months again and moves money: CPF crediting, interest, withdrawals,
//        the age-55 transition, household cash flow and the savings portfolio.

import {
  MI, parseYM, fmtYM, labelYM, yearOf, monthOf, parseDate, bandAge, ageAtStart, ageOn, birthdayMonth, mi,
} from './calendar';
import { Config, Grade, Allowance } from './config';
import {
  contributionBand, allocationBand, FULL_RATES, GG_RATES, ALLOCATION, inForce,
  FRS_ANNOUNCED, residentTax,
} from './rules';

// ---------- small helpers ----------
const EPS = 1e-9;
export const roundHalfUpDollar = (x: number) => Math.floor(x + 0.5 + EPS);
export const floorDollar = (x: number) => Math.floor(x + EPS);
const round2 = (x: number) => Math.round((x + Math.sign(x) * EPS) * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ---------- official-rule helpers ----------
export interface ContributionResult { total: number; employee: number; employer: number; totalRate: number; employeeRate: number }

/** CPF contribution for one wage month, following the published table formulas and rounding steps. */
export function cpfContribution(totalWages: number, owSub: number, awSub: number, totalRatePct: number, employeeRatePct: number): ContributionResult {
  const tr = totalRatePct / 100, er = employeeRatePct / 100, employerRate = tr - er;
  let total = 0, employee = 0;
  const tw = totalWages;
  if (tw <= 50) { total = 0; employee = 0; }
  else if (tw <= 500) { total = employerRate * tw; employee = 0; }
  else if (tw <= 750) { employee = 3 * er * (tw - 500); total = employerRate * tw + employee; }
  else { total = tr * (owSub + awSub); employee = er * (owSub + awSub); }
  const t = roundHalfUpDollar(total), e = Math.min(t, floorDollar(employee));
  return { total: t, employee: e, employer: t - e, totalRate: totalRatePct, employeeRate: employeeRatePct };
}

/** FRS for the cohort turning 55 in `year`: announced figures, then projected growth. */
export function frsFor(cfg: Config, year: number): number {
  const years = Object.keys(FRS_ANNOUNCED).map(Number).sort();
  const last = years[years.length - 1];
  if (year <= years[0]) return FRS_ANNOUNCED[years[0]];
  if (FRS_ANNOUNCED[year]) return FRS_ANNOUNCED[year];
  return FRS_ANNOUNCED[last] * Math.pow(1 + cfg.cpf.frsGrowth, year - last);
}
export const isFrsProjected = (year: number) => !(year in FRS_ANNOUNCED) && year > 2027;

export function bhsFor(cfg: Config, year: number): number {
  if (year <= 2026) return cfg.cpf.bhs2026;
  return cfg.cpf.bhs2026 * Math.pow(1 + cfg.cpf.bhsGrowth, year - 2026);
}

export function owCeilingFor(cfg: Config, m: MI): number {
  const from = parseYM(cfg.cpf.owCeilingFrom);
  if (m < from) return cfg.cpf.owCeiling;
  return cfg.cpf.owCeiling * Math.pow(1 + cfg.cpf.owCeilingGrowth, yearOf(m) - yearOf(from));
}

// ---------- row types ----------
export interface MonthRow {
  mi: MI; ym: string; label: string; year: number; month: number; idx: number;
  age: number; bandAge: number;
  // pay
  grade: string; gradeMin: number; gradeMax: number; basic: number; allowance: number;
  incrementApplied: number; blockedMonthly: number; promotionAmount: number; promotionCapped: number; minAdjustment: number;
  bonus: number; aws: number; lump: number; lumpEntitled: number; gross: number; regularPay: number;
  // cpf contributions (wage month)
  cpfPhase: string; owCPFable: number; owCeiling: number; owSub: number; awCPFable: number; awSub: number; awCapLeft: number;
  totalRate: number; employeeRate: number; employeeCPF: number; employerCPF: number; totalCPF: number;
  allocMA: number; allocSA: number; allocOA: number;
  // tax and cash
  tax: number; expenses: number; cashAfterCPF: number; cashAfterTaxExp: number;
  plannedSave: number; saved: number; shortfall: number; leftover: number; unfunded: number; topUpCash: number;
  // cpf balances (posted) and accrued interest
  oa: number; sa: number; ma: number; ra: number; accOA: number; accSA: number; accMA: number; accRA: number;
  cpfCredited: number; cpfInterestCredited: number; cpfInterestAccrued: number; housing: number; medical: number; voluntaryIn: number; transferOAtoSA: number;
  bhs: number; frsNow: number;
  // portfolio
  cash: number; cashAccrued: number; fdWaiting: number; fdPrincipal: number; fdAccrued: number;
  ssbWaiting: number; ssbFace: number; ssbAccrued: number; bondsCost: number; bondsMarket: number; fund: number;
  portfolioBook: number; portfolioValue: number;
  // cumulative
  cumCPFContrib: number; cumCPFInterest: number; cumSavingsContrib: number; cumSavingsEarnings: number; cumPayouts: number;
  // totals
  cpfTotal: number; totalAssets: number; deflator: number;
  events: string[];
}

export interface YearRow {
  year: number; months: number; ageEnd: number; grade: string; basicEnd: number;
  salary: number; allowances: number; bonus: number; aws: number; lump: number; gross: number;
  owSub: number; awSub: number; awCap: number; employeeCPF: number; employerCPF: number; tax: number; expenses: number;
  saved: number; shortfall: number; unfunded: number; cpfInterestCredited: number;
  packageSnapshot: number; // annualised package at year end (not cash received)
  oa: number; sa: number; ma: number; ra: number; cpfTotal: number; portfolioValue: number; totalAssets: number; deflator: number;
}

export interface Age55 {
  month: string; frsCohort: number; target: number; projected: boolean;
  before: { oa: number; sa: number; ma: number; ra: number; accrued: number };
  after: { oa: number; sa: number; ma: number; ra: number; accrued: number };
}

export interface Milestone { mi: MI; ym: string; kind: string; text: string }

export interface Ledger {
  cpf: { start: number; contributions: number; voluntary: number; interestCredited: number; withdrawals: number; posted: number; accrued: number };
  savings: { start: number; contributions: number; deposits: number; swept: number; earnings: number; withdrawals: number; payouts: number; fees: number; book: number };
}

export interface Result {
  months: MonthRow[]; years: YearRow[]; age55: Age55 | null; milestones: Milestone[]; warnings: string[]; ledger: Ledger;
  startAge: number;
}

// ---------- pass 1: pay ----------
interface PayState { basic: number; grade: string; grades: Grade[]; blocked: number; pendingLump: number; allowanceMult: Record<string, number> }

function gradeOf(grades: Grade[], idg: string): Grade | undefined { return grades.find(g => g.id === idg); }

function activeAllowances(list: Allowance[], m: MI, mult: Record<string, number>) {
  return list.filter(a => {
    const from = parseYM(a.from); const to = a.to ? parseYM(a.to) : Infinity;
    return m >= from && m <= to;
  }).map(a => ({ a, amount: a.amount * (mult[a.id] ?? 1) }));
}

function refWindow(ref: string, payM: MI): MI[] {
  const y = yearOf(payM); const out: MI[] = [];
  if (ref === 'trailing-12') for (let k = payM - 11; k <= payM; k++) out.push(k);
  else if (ref === 'calendar-year') for (let k = mi(y, 1); k <= mi(y, 12); k++) out.push(k);
  else for (let k = mi(y - 1, 1); k <= mi(y - 1, 12); k++) out.push(k);
  return out;
}

export function simulate(cfg: Config): Result {
  const warnings: string[] = [];
  const milestones: Milestone[] = [];
  const addMs = (m: MI, kind: string, text: string) => milestones.push({ mi: m, ym: fmtYM(m), kind, text });

  const start = parseYM(cfg.profile.startYM);
  const birth = parseDate(cfg.profile.birthDate);
  const b55 = birthdayMonth(birth, 55);
  const endAgeMonth = birthdayMonth(birth, Math.max(cfg.profile.endAge, 1));
  const end = Math.max(mi(yearOf(endAgeMonth), 12), start + 11);
  const startAge = ageAtStart(birth, start);
  if (cfg.salary.incRate < 0) warnings.push('Increment rate is negative.');

  const S = cfg.salary;
  const st: PayState = { basic: S.startBasic, grade: S.startGrade, grades: S.grades.map(g => ({ ...g })), blocked: 0, pendingLump: 0, allowanceMult: {} };
  if (!gradeOf(st.grades, st.grade)) warnings.push(`Starting grade ${st.grade} is not in the grade table.`);
  const startG = gradeOf(st.grades, st.grade);
  if (startG && S.startBasic > startG.max) warnings.push(`Starting basic $${S.startBasic} is above the ${st.grade} maximum.`);
  for (const p of S.promotions) if (!gradeOf(st.grades, p.toGrade)) warnings.push(`Promotion in ${p.ym} goes to unknown grade ${p.toGrade}; it is ignored.`);

  const empStart = parseYM(cfg.bonus.employmentStart);
  const basis = new Map<MI, { bonus: number; aws: number }>();
  const basisFor = (allow: { a: Allowance; amount: number }[], basic: number, blocked: number) => {
    const extra = S.lumpSum.bonusable ? blocked : 0;
    return {
      bonus: basic + sum(allow.filter(x => x.a.bonus).map(x => x.amount)) + extra,
      aws: basic + sum(allow.filter(x => x.a.aws).map(x => x.amount)) + extra,
    };
  };
  // months between employment start and projection start use the starting pay (stated assumption)
  for (let m = Math.min(empStart, start); m < start; m++) basis.set(m, basisFor(activeAllowances(cfg.allowances, m, {}), S.startBasic, 0));

  const rows: MonthRow[] = [];
  let firstCap = true, owHit = false;
  for (let m = start, idx = 0; m <= end; m++, idx++) {
    const year = yearOf(m), month = monthOf(m);
    const events: string[] = [];
    const isInc = month === S.incMonth && year >= S.incFirstYear;
    const promos = S.promotions.filter(p => parseYM(p.ym) === m && gradeOf(st.grades, p.toGrade));
    let incApplied = 0, blockedNow = 0, promoAmt = 0, promoCapped = 0, minAdj = 0;

    if (isInc && S.bandGrowth) for (const g of st.grades) { g.min *= 1 + S.bandGrowth; g.max *= 1 + S.bandGrowth; }

    const applyIncrement = (ceiling: number) => {
      const before = st.basic, uncapped = before * (1 + S.incRate);
      const after = Math.max(before, Math.min(uncapped, ceiling));
      st.basic = after; incApplied = after - before; blockedNow = uncapped - after;
    };
    const applyPromo = (p: { toGrade: string; amount: number; ym: string }) => {
      const g = gradeOf(st.grades, p.toGrade)!;
      const before = st.basic, wanted = before + p.amount;
      st.basic = Math.max(before, Math.min(wanted, g.max));
      promoAmt += st.basic - before; promoCapped += wanted - st.basic;
      st.grade = g.id;
      if (S.adjustToMinOnPromotion && st.basic < g.min) { minAdj += g.min - st.basic; st.basic = g.min; }
      events.push(`Promotion to ${g.id} (+$${p.amount})`);
      addMs(m, 'promotion', `Promoted to ${g.id}`);
    };

    if (isInc && promos.length) {
      if (S.order === 'increment-first') {
        const finalGrade = gradeOf(st.grades, promos[promos.length - 1].toGrade)!;
        const ceiling = S.sameMonthCeiling === 'new-grade' ? finalGrade.max : gradeOf(st.grades, st.grade)!.max;
        applyIncrement(ceiling);
        promos.forEach(applyPromo);
      } else {
        promos.forEach(applyPromo);
        applyIncrement(gradeOf(st.grades, st.grade)!.max);
      }
    } else if (isInc) {
      const g = gradeOf(st.grades, st.grade);
      applyIncrement(g ? g.max : Infinity);
    } else promos.forEach(applyPromo);
    if (promoCapped > 0.005) events.push(`Promotion increase capped by $${promoCapped.toFixed(2)} at grade maximum`);

    let lumpEntitled = 0;
    if (isInc) {
      st.blocked = blockedNow;
      if (blockedNow > 0.005) {
        if (S.lumpSum.policy === 'blocked12') lumpEntitled = blockedNow * 12;
        else if (S.lumpSum.policy === 'custom') lumpEntitled = S.lumpSum.customAmount;
        st.pendingLump += lumpEntitled;
        events.push(`Increment blocked by $${blockedNow.toFixed(2)}/month at ${st.grade} ceiling`);
        if (firstCap) { addMs(m, 'ceiling', `Basic reaches ${st.grade} ceiling`); firstCap = false; }
      }
      for (const { a } of activeAllowances(cfg.allowances, m, st.allowanceMult)) if (a.grows && parseYM(a.from) < m) st.allowanceMult[a.id] = (st.allowanceMult[a.id] ?? 1) * (1 + S.incRate);
    }
    let lump = 0;
    if (month === S.lumpSum.payMonth && st.pendingLump > 0) { lump = st.pendingLump; st.pendingLump = 0; events.push(`Ceiling lump sum paid $${lump.toFixed(2)}`); }

    const allow = activeAllowances(cfg.allowances, m, st.allowanceMult);
    for (const a of cfg.allowances) if (parseYM(a.from) === m) addMs(m, 'allowance', `${a.label}: $${a.amount}/month`);
    const allowance = sum(allow.map(x => x.amount));
    const allowanceCPF = sum(allow.filter(x => x.a.cpf).map(x => x.amount));
    basis.set(m, basisFor(allow, st.basic, st.blocked));

    const payout = (months: number, payMonth: number, ref: string, method: string, key: 'bonus' | 'aws') => {
      if (month !== payMonth || months <= 0) return 0;
      const win = refWindow(ref, m);
      const employed = win.filter(k => k >= empStart);
      if (!employed.length) return 0;
      const b = (k: MI) => (basis.get(Math.min(k, m)) ?? basis.get(m)!)[key];
      const factor = cfg.bonus.prorateFirstYear ? employed.length / 12 : 1;
      if (method === 'payment-month') return months * b(m) * factor;
      if (method === 'average') return months * (sum(employed.map(b)) / employed.length) * factor;
      return months * sum(employed.map(b)) / 12; // prorated: salary actually earned in the window
    };
    const ovr = cfg.bonus.overrides.find(o => o.year === year);
    const bonus = payout(ovr ? ovr.months : cfg.bonus.months, cfg.bonus.payMonth, cfg.bonus.reference, cfg.bonus.method, 'bonus');
    const aws = cfg.bonus.awsEnabled ? payout(cfg.bonus.awsMonths, cfg.bonus.awsPayMonth, cfg.bonus.awsReference, cfg.bonus.awsMethod, 'aws') : 0;

    const g = gradeOf(st.grades, st.grade);
    const owCPFable = st.basic + allowanceCPF;
    const owCeil = owCeilingFor(cfg, m);
    if (!owHit && owCPFable >= owCeil) { owHit = true; addMs(m, 'cpf', `Monthly CPF-able pay reaches OW ceiling ($${Math.round(owCeil)})`); }
    const regularPay = st.basic + allowance;
    rows.push({
      mi: m, ym: fmtYM(m), label: labelYM(m), year, month, idx,
      age: ageAtStart(birth, m), bandAge: bandAge(birth, m),
      grade: st.grade, gradeMin: g?.min ?? 0, gradeMax: g?.max ?? 0, basic: st.basic, allowance,
      incrementApplied: incApplied, blockedMonthly: isInc ? blockedNow : 0, promotionAmount: promoAmt, promotionCapped: promoCapped, minAdjustment: minAdj,
      bonus, aws, lump, lumpEntitled, gross: regularPay + bonus + aws + lump, regularPay,
      cpfPhase: '', owCPFable, owCeiling: owCeil, owSub: Math.min(owCPFable, owCeil), awCPFable: bonus + aws + (S.lumpSum.cpfable ? lump : 0), awSub: 0, awCapLeft: 0,
      totalRate: 0, employeeRate: 0, employeeCPF: 0, employerCPF: 0, totalCPF: 0, allocMA: 0, allocSA: 0, allocOA: 0,
      tax: 0, expenses: 0, cashAfterCPF: 0, cashAfterTaxExp: 0, plannedSave: 0, saved: 0, shortfall: 0, leftover: 0, unfunded: 0, topUpCash: 0,
      oa: 0, sa: 0, ma: 0, ra: 0, accOA: 0, accSA: 0, accMA: 0, accRA: 0, cpfCredited: 0, cpfInterestCredited: 0, cpfInterestAccrued: 0,
      housing: 0, medical: 0, voluntaryIn: 0, transferOAtoSA: 0, bhs: 0, frsNow: 0,
      cash: 0, cashAccrued: 0, fdWaiting: 0, fdPrincipal: 0, fdAccrued: 0, ssbWaiting: 0, ssbFace: 0, ssbAccrued: 0, bondsCost: 0, bondsMarket: 0, fund: 0,
      portfolioBook: 0, portfolioValue: 0, cumCPFContrib: 0, cumCPFInterest: 0, cumSavingsContrib: 0, cumSavingsEarnings: 0, cumPayouts: 0,
      cpfTotal: 0, totalAssets: 0, deflator: Math.pow(1 + cfg.inflation, -idx / 12), events,
    });
  }

  // ---------- pass 1b: CPF contributions ----------
  const C = cfg.cpf;
  const yearOW = new Map<number, number>();
  for (const r of rows) yearOW.set(r.year, (yearOW.get(r.year) ?? 0) + r.owSub);
  const capLeft = new Map<number, number>();
  for (const [y, ow] of yearOW) capLeft.set(y, Math.max(0, C.annualCeiling - ow - (y === yearOf(start) ? C.preStartOW + C.preStartAW : 0)));
  const prM = C.status === 'pr' ? parseYM(C.prDate) : -Infinity;
  let lastPhase = '', lastBand = -1;
  const mandatoryByYear = new Map<number, number>();
  for (const r of rows) {
    let phase = 'full';
    if (C.status === 'pr' && C.prScheme !== 'FF') {
      const since = r.mi - prM;
      // Assumption (not verified): the next SPR-year rate starts the month after the anniversary month.
      if (since < 0) phase = 'none'; else if (since <= 12) phase = 'pr1'; else if (since <= 24) phase = 'pr2';
    } else if (C.status === 'pr' && r.mi < prM) phase = 'none';
    r.cpfPhase = phase;
    if (phase !== lastPhase) { if (lastPhase) addMs(r.mi, 'cpf', `CPF rates: ${phaseLabel(phase)}`); lastPhase = phase; }
    const band = contributionBand(r.bandAge);
    if (band !== lastBand) { if (lastBand >= 0) addMs(r.mi, 'cpf', `Age-band CPF rates change (${['55 & below', 'above 55-60', 'above 60-65', 'above 65-70', 'above 70'][band]})`); lastBand = band; }
    const cap = capLeft.get(r.year) ?? 0;
    r.awSub = phase === 'none' ? 0 : Math.min(r.awCPFable, cap);
    capLeft.set(r.year, cap - r.awSub);
    r.awCapLeft = capLeft.get(r.year)!;
    if (phase === 'none') continue;
    const full = inForce(FULL_RATES, r.ym).rows[band];
    let tot = full[0], emp = full[1];
    if (phase === 'pr1' || phase === 'pr2') {
      const gg = GG_RATES[phase === 'pr1' ? 1 : 2][band];
      if (C.prScheme === 'GG') { tot = gg[0]; emp = gg[1]; } else { emp = gg[1]; tot = (full[0] - full[1]) + gg[1]; }
    }
    const res = cpfContribution(r.owCPFable + r.awCPFable, r.owSub, r.awSub, tot, emp);
    r.totalRate = tot; r.employeeRate = emp;
    r.employeeCPF = res.employee; r.employerCPF = res.employer; r.totalCPF = res.total;
    const ratio = inForce(ALLOCATION, r.ym).rows[allocationBand(r.bandAge)];
    r.allocMA = round2(res.total * ratio[0]); r.allocSA = round2(res.total * ratio[1]); r.allocOA = res.total - r.allocMA - r.allocSA;
    mandatoryByYear.set(r.year, (mandatoryByYear.get(r.year) ?? 0) + res.total);
  }

  // ---------- pass 1c: tax provision ----------
  const yearAgg = new Map<number, { income: number; empCPF: number }>();
  for (const r of rows) {
    const a = yearAgg.get(r.year) ?? { income: r.year === yearOf(start) ? cfg.tax.preStartIncome : 0, empCPF: r.year === yearOf(start) ? C.preStartEmployeeCPF : 0 };
    a.income += r.gross; a.empCPF += r.employeeCPF; yearAgg.set(r.year, a);
  }
  const taxByYear = new Map<number, number>();
  for (const [y, a] of yearAgg) {
    const age = ageOn(birth, y, 12, 31);
    const eir = age < 55 ? 1000 : age < 60 ? 6000 : 8000;
    const reliefs = Math.min(80000, eir + Math.min(a.empCPF, C.annualLimit) + cfg.tax.otherReliefs);
    taxByYear.set(y, residentTax(Math.max(0, a.income - reliefs)));
  }
  for (const r of rows) {
    if (cfg.tax.mode === 'manual') r.tax = cfg.tax.manualMonthly;
    else if (cfg.tax.mode === 'estimate') { const a = yearAgg.get(r.year)!; r.tax = a.income > 0 ? taxByYear.get(r.year)! * r.gross / a.income : 0; }
    r.expenses = cfg.expenses.monthly * (cfg.expenses.inflationLinked ? Math.pow(1 + cfg.inflation, r.idx / 12) : 1);
    r.cashAfterCPF = r.gross - r.employeeCPF;
    r.cashAfterTaxExp = r.cashAfterCPF - r.tax - r.expenses;
  }

  // ---------- pass 2: balances ----------
  const cpf = { oa: C.startOA, sa: C.startSA, ma: C.startMA, ra: 0 };
  const acc = { oa: 0, sa: 0, ma: 0, ra: 0 };
  const L: Ledger = {
    cpf: { start: C.startOA + C.startSA + C.startMA, contributions: 0, voluntary: 0, interestCredited: 0, withdrawals: 0, posted: 0, accrued: 0 },
    savings: { start: cfg.savings.startCash, contributions: 0, deposits: 0, swept: 0, earnings: 0, withdrawals: 0, payouts: 0, fees: 0, book: 0 },
  };
  let age55: Age55 | null = null;
  let bhsHit = false, frsHit = false;
  const volMAByYear = new Map<number, number>();
  const target55 = () => { const f = frsFor(cfg, yearOf(b55)); return C.retirementTarget === 'BRS' ? f / 2 : f; };

  // savings portfolio state
  const P = cfg.savings;
  const port = { cash: P.startCash, cashAcc: 0, fdWait: 0, ssbWait: 0, fund: 0 };
  interface FD { principal: number; rate: number; start: MI; months: number }
  interface SSB { face: number; issue: MI; coupons: number[]; paidThrough: MI }
  interface BondH { face: number; cost: number; buy: MI; maturity: MI; couponPct: number; freq: number; yieldPct: number; label: string }
  let fds: FD[] = [];
  let ssbs: SSB[] = [];
  let bonds: BondH[] = [];
  const allocSum = P.alloc.cash + P.alloc.fd + P.alloc.ssb + P.alloc.fund;
  if (Math.abs(allocSum - 1) > 0.001) warnings.push(`Savings allocation adds up to ${(allocSum * 100).toFixed(0)}%; contributions are scaled to 100%.`);
  const norm = allocSum > 0 ? allocSum : 1;
  let shortfallMonths = 0, unfundedTotal = 0, topUpCut = 0;

  const fdAccrued = (f: FD, at: MI) => {
    const el = Math.min(at - f.start, f.months);
    return P.fd.compounding === 'simple' ? f.principal * f.rate * el / 12 : f.principal * (Math.pow(1 + f.rate / 12, el) - 1);
  };
  const ssbRateAt = (s: SSB, at: MI) => { const yrs = Math.floor((at - s.issue) / 12); return (s.coupons[Math.min(Math.max(yrs, 0), 9)] ?? 0) / 100; };
  const ssbAccrued = (s: SSB, at: MI) => at <= s.issue ? 0 : s.face * ssbRateAt(s, at - 1) * (at - s.paidThrough) / 12;
  const bondMarket = (b: BondH, at: MI) => {
    const step = 12 / b.freq, c = b.face * b.couponPct / 100 / b.freq, y = b.yieldPct / 100 / b.freq;
    let pv = 0;
    for (let k = b.buy + step; k <= b.maturity + 0.001; k += step) if (k > at) {
      const n = (k - at) / step;
      pv += (c + (Math.abs(k - b.maturity) < 0.001 ? b.face : 0)) / Math.pow(1 + y, n);
    }
    return pv;
  };

  /** Raise `need` dollars from the portfolio, most liquid first. Returns what could not be raised. */
  const drawdown = (need: number, t: MI): number => {
    const take = (have: number) => { const x = Math.min(have, need); need -= x; return x; };
    port.cash -= take(port.cash); if (need <= EPS) return 0;
    port.fdWait -= take(port.fdWait); if (need <= EPS) return 0;
    port.ssbWait -= take(port.ssbWait); if (need <= EPS) return 0;
    port.fund -= take(port.fund); if (need <= EPS) return 0;
    // redeem SSBs (newest first) in $500 units at face plus accrued interest
    for (const s of [...ssbs].reverse()) {
      if (need <= EPS) break;
      const units = Math.min(s.face, Math.ceil(need / 500) * 500);
      const interest = ssbAccrued(s, t) * units / s.face;
      s.face -= units; L.savings.earnings += interest; port.cash += units + interest;
      port.cash -= take(port.cash);
    }
    ssbs = ssbs.filter(s => s.face > EPS);
    // break FDs (newest first)
    for (const f of [...fds].reverse()) {
      if (need <= EPS) break;
      const accrued = fdAccrued(f, t);
      const paid = P.fd.penalty === 'none' ? accrued : P.fd.penalty === 'forfeit-pct' ? accrued * (1 - P.fd.penaltyPct) : 0;
      L.savings.earnings += paid; port.cash += f.principal + paid; f.principal = 0;
      port.cash -= take(port.cash);
    }
    fds = fds.filter(f => f.principal > EPS);
    return need;
  };

  const pending = new Map<MI, MonthRow>(); // contributions waiting to be credited
  let cumCPFContrib = 0, cumCPFInterest = 0, cumSave = 0, cumEarn = 0, cumPay = 0;

  for (const r of rows) {
    const t = r.mi, year = r.year;
    const raOpen = t >= b55;
    const frsNow = frsFor(cfg, year), bhsNow = bhsFor(cfg, Math.min(year, yearOf(birthdayMonth(birth, 65))));
    r.bhs = bhsNow; r.frsNow = frsNow;

    // --- age 55: form RA from SA then OA, close SA ---
    if (t === b55) {
      const snap = () => ({ oa: cpf.oa, sa: cpf.sa, ma: cpf.ma, ra: cpf.ra, accrued: acc.oa + acc.sa + acc.ma + acc.ra });
      const before = snap();
      const target = target55();
      const fromSA = Math.min(cpf.sa, Math.max(0, target - cpf.ra));
      cpf.ra += fromSA; cpf.sa -= fromSA; cpf.oa += cpf.sa; cpf.sa = 0;
      const fromOA = Math.min(cpf.oa, Math.max(0, target - cpf.ra));
      cpf.ra += fromOA; cpf.oa -= fromOA;
      acc.ra += acc.sa; acc.sa = 0;
      age55 = { month: r.ym, frsCohort: frsFor(cfg, yearOf(b55)), target, projected: isFrsProjected(yearOf(b55)), before, after: snap() };
      r.events.push('Age 55: Retirement Account formed; Special Account closed');
      addMs(t, 'age55', 'Age 55: RA formed, SA closed');
    }
    const open = { ...cpf };
    const out = { oa: 0, sa: 0, ma: 0, ra: 0 };

    const toRetirement = (x: number) => { // into SA (below 55, up to current FRS) or RA (55+, up to cohort target); rest to OA
      if (raOpen) { const room = Math.max(0, target55() - cpf.ra); const y = Math.min(x, room); cpf.ra += y; cpf.oa += x - y; }
      else { const room = Math.max(0, frsNow - cpf.sa); const y = Math.min(x, room); cpf.sa += y; cpf.oa += x - y; }
    };
    const creditMA = (x: number) => {
      const room = Math.max(0, bhsNow - cpf.ma); const y = Math.min(x, room);
      cpf.ma += y; if (x - y > EPS) toRetirement(x - y);
    };

    // --- credit mandatory contributions for the wage month `lag` months back ---
    pending.set(t, r);
    const due = pending.get(t - C.contributionLag);
    if (due) {
      pending.delete(t - C.contributionLag);
      creditMA(due.allocMA);
      if (raOpen) { const room = Math.max(0, target55() - cpf.ra); const y = Math.min(due.allocSA, room); cpf.ra += y; cpf.oa += due.allocSA - y; }
      else cpf.sa += due.allocSA; // mandatory SA contributions are not capped at FRS
      cpf.oa += due.allocOA;
      r.cpfCredited = due.totalCPF; L.cpf.contributions += due.totalCPF; cumCPFContrib += due.totalCPF;
    }

    // --- scheduled withdrawals ---
    const inRange = (d: { from: string; to: string }) => t >= parseYM(d.from) && t <= (d.to ? parseYM(d.to) : Infinity);
    for (const h of C.housing.filter(inRange)) { const x = Math.min(h.monthly, cpf.oa); cpf.oa -= x; out.oa += x; r.housing += x; if (x + 0.005 < h.monthly) r.events.push('OA too low for full housing payment'); }
    for (const h of C.medical.filter(inRange)) { const x = Math.min(h.monthly, cpf.ma); cpf.ma -= x; out.ma += x; r.medical += x; if (x + 0.005 < h.monthly) r.events.push('MediSave too low for full deduction'); }
    L.cpf.withdrawals += r.housing + r.medical;

    // --- OA -> SA/RA transfers ---
    const occurs = (d: { ym: string; repeatYearly: boolean; until: string }) => {
      const s = parseYM(d.ym); if (t < s) return false; if (t === s) return true;
      if (!d.repeatYearly || monthOf(t) !== monthOf(s)) return false;
      return !d.until || t <= parseYM(d.until);
    };
    const ers = 2 * frsNow;
    for (const tr of C.transfers.filter(occurs)) {
      const room = raOpen ? Math.max(0, ers - cpf.ra) : Math.max(0, frsNow - cpf.sa);
      const x = Math.min(tr.amount, cpf.oa, room);
      cpf.oa -= x; out.oa += x; if (raOpen) cpf.ra += x; else cpf.sa += x; r.transferOAtoSA += x;
    }

    // --- cash top-ups (funded from this month's cash, then savings) ---
    const liquid = () => port.cash + port.fdWait + port.ssbWait + port.fund;
    let topUpCash = 0;
    for (const v of C.voluntary.filter(occurs)) {
      let room: number;
      if (v.account === 'SA_RA') room = raOpen ? Math.max(0, ers - cpf.ra) : Math.max(0, frsNow - cpf.sa);
      else room = Math.min(Math.max(0, bhsNow - cpf.ma), Math.max(0, C.annualLimit - (mandatoryByYear.get(year) ?? 0) - (volMAByYear.get(year) ?? 0)));
      const affordable = Math.max(0, r.cashAfterTaxExp - topUpCash) + liquid();
      const x = Math.min(v.amount, room, affordable);
      if (x + 0.005 < v.amount) { topUpCut++; r.events.push(`Top-up cut to $${x.toFixed(0)} (limit or cash)`); }
      if (v.account === 'SA_RA') { if (raOpen) cpf.ra += x; else cpf.sa += x; } else { cpf.ma += x; volMAByYear.set(year, (volMAByYear.get(year) ?? 0) + x); }
      topUpCash += x; r.voluntaryIn += x;
    }
    L.cpf.voluntary += r.voluntaryIn; cumCPFContrib += r.voluntaryIn;
    r.topUpCash = topUpCash;

    // --- CPF interest: computed monthly on the lowest balance, credited at year end ---
    const low = { oa: Math.max(0, open.oa - out.oa), sa: Math.max(0, open.sa - out.sa), ma: Math.max(0, open.ma - out.ma), ra: Math.max(0, open.ra - out.ra) };
    let accruedNow = low.oa * C.oaRate / 12 + (low.sa + low.ma + low.ra) * C.smraRate / 12;
    acc.oa += low.oa * C.oaRate / 12; acc.sa += low.sa * C.smraRate / 12; acc.ma += low.ma * C.smraRate / 12; acc.ra += low.ra * C.smraRate / 12;
    if (C.extraInterest) {
      const tiers: [number, number][] = ageAtStart(birth, t) >= 55 ? [[30000, 0.02], [30000, 0.01]] : [[60000, 0.01]];
      const order: [keyof typeof low, number][] = [['ra', low.ra], ['oa', Math.min(low.oa, 20000)], ['sa', low.sa], ['ma', low.ma]];
      let ti = 0, tierLeft = tiers[0][0];
      for (const [k, bal] of order) {
        let left = bal;
        while (left > EPS && ti < tiers.length) {
          const x = Math.min(left, tierLeft); const extra = x * tiers[ti][1] / 12;
          const dest = (k === 'oa' ? (raOpen ? 'ra' : 'sa') : k) as keyof typeof acc;
          acc[dest] += extra; accruedNow += extra;
          left -= x; tierLeft -= x;
          if (tierLeft <= EPS) { ti++; if (ti < tiers.length) tierLeft = tiers[ti][0]; }
        }
      }
    }
    if (raOpen && acc.sa) { acc.ra += acc.sa; acc.sa = 0; }
    r.cpfInterestAccrued = accruedNow;
    if (r.month === 12) { // interest computed monthly is credited and compounded once a year
      const credited = acc.oa + acc.sa + acc.ma + acc.ra;
      cpf.oa += acc.oa; cpf.sa += acc.sa; cpf.ra += acc.ra; creditMA(acc.ma);
      r.cpfInterestCredited = credited; L.cpf.interestCredited += credited; cumCPFInterest += credited;
      acc.oa = acc.sa = acc.ma = acc.ra = 0;
    }
    if (!bhsHit && cpf.ma >= bhsNow - 0.5) { bhsHit = true; addMs(t, 'cpf', 'MediSave reaches Basic Healthcare Sum; excess now overflows'); }
    if (!frsHit && !raOpen && cpf.sa >= frsNow) { frsHit = true; addMs(t, 'cpf', 'SA reaches current FRS; MediSave overflow now goes to OA'); }

    // ---------- savings portfolio ----------
    // 1. earnings on opening positions
    port.cashAcc += port.cash * P.cash.rate / 12;
    const creditCash = P.cash.credit === 'monthly' || (P.cash.credit === 'quarterly' && r.month % 3 === 0) || (P.cash.credit === 'annual' && r.month === 12);
    if (creditCash) { port.cash += port.cashAcc; L.savings.earnings += port.cashAcc; port.cashAcc = 0; }
    const newFds: FD[] = [];
    for (const f of fds) {
      if (t - f.start >= f.months) {
        const interest = fdAccrued(f, t); L.savings.earnings += interest;
        if (P.fd.renewal === 'stop') port.cash += f.principal + interest;
        else if (P.fd.renewal === 'principal') { port.cash += interest; newFds.push({ principal: f.principal, rate: P.fd.renewRate, start: t, months: P.fd.tenure }); }
        else newFds.push({ principal: f.principal + interest, rate: P.fd.renewRate, start: t, months: P.fd.tenure });
        r.events.push(`FD matured: $${f.principal.toFixed(0)} + $${interest.toFixed(2)} interest`);
      } else newFds.push(f);
    }
    fds = newFds;
    let couponsOut = 0;
    const payCoupon = (c: number) => { L.savings.earnings += c; if (P.reinvestCoupons) port.cash += c; else { L.savings.payouts += c; couponsOut += c; } };
    for (const s of ssbs) {
      if (t > s.issue && (t - s.issue) % 6 === 0 && t - s.issue <= 120) { payCoupon(s.face * ssbRateAt(s, t - 1) / 2); s.paidThrough = t; }
      if (t - s.issue === 120) { port.cash += s.face; s.face = 0; r.events.push('SSB matured'); }
    }
    ssbs = ssbs.filter(s => s.face > EPS);
    for (const b of bonds) {
      const step = 12 / b.freq;
      if (t > b.buy && (t - b.buy) % step === 0 && t <= b.maturity) payCoupon(b.face * b.couponPct / 100 / b.freq);
      if (t === b.maturity) { port.cash += b.face; L.savings.earnings += b.face - b.cost; b.face = 0; r.events.push(`${b.label} matured`); }
    }
    bonds = bonds.filter(b => b.face > EPS);
    if (port.fund > 0) {
      const g = port.fund * (Math.pow(1 + (P.fund.returnPct - P.fund.feePct) / 100, 1 / 12) - 1);
      port.fund += g; L.savings.earnings += g;
    }
    if (P.fund.shockYM && parseYM(P.fund.shockYM) === t && port.fund > 0) {
      const loss = port.fund * P.fund.shockPct / 100; port.fund -= loss; L.savings.earnings -= loss; r.events.push(`Bond fund drawdown -${P.fund.shockPct}%`);
    }

    // 2. this month's cash flow
    const cashNet = r.cashAfterTaxExp - topUpCash;
    const empOW = r.owSub + r.awSub > 0 ? r.employeeCPF * r.owSub / (r.owSub + r.awSub) : 0;
    const planned = P.fixedMonthly + P.pctSalaryAfterCPF * Math.max(0, r.regularPay - empOW) + P.pctBonus * (r.bonus + r.aws) + P.pctLump * r.lump;
    r.plannedSave = planned;
    let contrib = 0;
    if (cashNet >= planned) {
      contrib = planned; r.leftover = cashNet - planned;
      if (P.leftover === 'sweep') { port.cash += r.leftover; L.savings.swept += r.leftover; }
    } else if (cashNet >= 0) { contrib = cashNet; r.shortfall = planned - cashNet; }
    else { r.shortfall = planned; const left = drawdown(-cashNet, t); L.savings.withdrawals += -cashNet - left; r.unfunded += left; }
    if (r.shortfall > 0.005) shortfallMonths++;
    r.saved = contrib;
    L.savings.contributions += contrib;
    let deposits = 0;
    for (const o of P.oneOffs.filter(o => parseYM(o.ym) === t)) {
      if (o.amount >= 0) { deposits += o.amount; L.savings.deposits += o.amount; }
      else { const want = -o.amount; const left = drawdown(want, t); L.savings.withdrawals += want - left; r.unfunded += left; if (left > 0.005) r.events.push(`Withdrawal short by $${left.toFixed(0)}`); }
    }
    unfundedTotal += r.unfunded;
    const inflow = contrib + deposits;
    port.cash += inflow * P.alloc.cash / norm;
    port.fdWait += inflow * P.alloc.fd / norm;
    port.ssbWait += inflow * P.alloc.ssb / norm;
    port.fund += inflow * P.alloc.fund / norm;
    cumSave += inflow + (P.leftover === 'sweep' ? r.leftover : 0);

    // 3. placements and purchases
    if (port.fdWait >= P.fd.min && port.fdWait > 0) {
      fds.push({ principal: port.fdWait, rate: t < start + P.fd.initialMonths ? P.fd.rate : P.fd.renewRate, start: t, months: P.fd.tenure });
      r.events.push(`FD placed $${port.fdWait.toFixed(0)}`); port.fdWait = 0;
    }
    const held = sum(ssbs.map(s => s.face));
    if (port.ssbWait >= 500 + P.ssb.feePerPurchase) {
      const room = Math.max(0, P.ssb.limit - held);
      const amt = Math.min(Math.floor((port.ssbWait - P.ssb.feePerPurchase) / 500) * 500, Math.floor(room / 500) * 500);
      if (amt >= 500) {
        port.ssbWait -= amt + P.ssb.feePerPurchase; L.savings.fees += P.ssb.feePerPurchase;
        ssbs.push({ face: amt, issue: t + 1, coupons: P.ssb.coupons.slice(), paidThrough: t + 1 });
      } else if (room < 500) { port.cash += port.ssbWait; port.ssbWait = 0; r.events.push('SSB holding limit reached; SSB share kept as cash'); }
    }
    for (const b of P.bonds.filter(b => parseYM(b.buyYM) === t)) {
      const cost = b.face * b.pricePer100 / 100;
      if (liquid() + EPS < cost) { warnings.push(`${b.label}: not enough savings to buy in ${b.buyYM}; purchase skipped.`); continue; }
      drawdown(cost, t);
      bonds.push({ face: b.face, cost, buy: t, maturity: parseYM(b.maturityYM), couponPct: b.couponPct, freq: b.couponsPerYear, yieldPct: b.marketYieldPct, label: b.label });
      r.events.push(`Bought ${b.label}`);
    }

    // ---------- record ----------
    Object.assign(r, { oa: cpf.oa, sa: cpf.sa, ma: cpf.ma, ra: cpf.ra, accOA: acc.oa, accSA: acc.sa, accMA: acc.ma, accRA: acc.ra });
    const fdP = sum(fds.map(f => f.principal)), fdA = sum(fds.map(f => fdAccrued(f, t)));
    const ssbF = sum(ssbs.map(s => s.face)), ssbA = sum(ssbs.map(s => ssbAccrued(s, t)));
    const bCost = sum(bonds.map(b => b.cost)), bMkt = sum(bonds.map(b => bondMarket(b, t)));
    Object.assign(r, {
      cash: port.cash, cashAccrued: port.cashAcc, fdWaiting: port.fdWait, fdPrincipal: fdP, fdAccrued: fdA,
      ssbWaiting: port.ssbWait, ssbFace: ssbF, ssbAccrued: ssbA, bondsCost: bCost, bondsMarket: bMkt, fund: port.fund,
    });
    r.portfolioBook = port.cash + port.fdWait + fdP + port.ssbWait + ssbF + bCost + port.fund;
    r.portfolioValue = r.portfolioBook + port.cashAcc + fdA + ssbA + (bMkt - bCost);
    cumEarn = L.savings.earnings; cumPay += couponsOut;
    r.cumCPFContrib = cumCPFContrib; r.cumCPFInterest = cumCPFInterest + acc.oa + acc.sa + acc.ma + acc.ra;
    r.cumSavingsContrib = cumSave; r.cumSavingsEarnings = cumEarn + port.cashAcc + fdA + ssbA + (bMkt - bCost); r.cumPayouts = cumPay;
    r.cpfTotal = cpf.oa + cpf.sa + cpf.ma + cpf.ra + acc.oa + acc.sa + acc.ma + acc.ra;
    r.totalAssets = r.cpfTotal + r.portfolioValue;
  }

  L.cpf.posted = cpf.oa + cpf.sa + cpf.ma + cpf.ra;
  L.cpf.accrued = acc.oa + acc.sa + acc.ma + acc.ra;
  const last = rows[rows.length - 1];
  L.savings.book = last.portfolioBook;

  if (shortfallMonths) warnings.push(`Planned savings could not be fully funded in ${shortfallMonths} month(s). See the audit table.`);
  if (unfundedTotal > 0.5) warnings.push(`Spending exceeded income and savings by $${Math.round(unfundedTotal).toLocaleString()} in total. That money does not exist in this projection.`);
  if (topUpCut) warnings.push(`${topUpCut} CPF top-up(s) were reduced by a limit (FRS, BHS, Annual Limit) or by available cash.`);
  if (startAge !== 31) warnings.push(`With this birth date you are ${startAge} at the start, not 31.`);

  // ---------- yearly roll-up ----------
  const years: YearRow[] = [];
  for (const y of [...new Set(rows.map(r => r.year))]) {
    const rs = rows.filter(r => r.year === y); const e = rs[rs.length - 1];
    const f = (k: keyof MonthRow) => sum(rs.map(r => r[k] as number));
    const allowAnn = e.allowance * 12;
    const basisE = e.basic + sum(activeAllowances(cfg.allowances, e.mi, {}).filter(x => x.a.bonus).map(x => x.amount));
    years.push({
      year: y, months: rs.length, ageEnd: e.age, grade: e.grade, basicEnd: e.basic,
      salary: f('basic'), allowances: f('allowance'), bonus: f('bonus'), aws: f('aws'), lump: f('lump'), gross: f('gross'),
      owSub: f('owSub'), awSub: f('awSub'), awCap: e.awCapLeft + f('awSub'),
      employeeCPF: f('employeeCPF'), employerCPF: f('employerCPF'), tax: f('tax'), expenses: f('expenses'),
      saved: f('saved'), shortfall: f('shortfall'), unfunded: f('unfunded'), cpfInterestCredited: f('cpfInterestCredited'),
      packageSnapshot: e.basic * 12 + allowAnn + basisE * (cfg.bonus.months + (cfg.bonus.awsEnabled ? cfg.bonus.awsMonths : 0)) + (rs.find(r => r.lumpEntitled)?.lumpEntitled ?? 0),
      oa: e.oa, sa: e.sa, ma: e.ma, ra: e.ra, cpfTotal: e.cpfTotal, portfolioValue: e.portfolioValue, totalAssets: e.totalAssets, deflator: e.deflator,
    });
  }
  milestones.sort((a, b) => a.mi - b.mi);
  return { months: rows, years, age55, milestones, warnings, ledger: L, startAge };
}

export function phaseLabel(p: string): string {
  return p === 'pr1' ? 'SPR year 1 (graduated)' : p === 'pr2' ? 'SPR year 2 (graduated)' : p === 'none' ? 'no CPF (not yet PR)' : 'full rates';
}
