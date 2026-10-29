import { describe, it, expect } from 'vitest';
import { defaultConfig, Config, clone } from '../src/config';
import { simulate, cpfContribution, MonthRow } from '../src/simulate';
import { residentTax } from '../src/rules';

const at = (rows: MonthRow[], ym: string) => { const r = rows.find(r => r.ym === ym); if (!r) throw new Error('no row ' + ym); return r; };
const close = (a: number, b: number, tol = 0.01) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

/** A quiet config: no allowances, bonus, savings or expenses, so one effect can be isolated. */
function quiet(): Config {
  const c = defaultConfig();
  c.allowances = []; c.bonus.months = 0; c.bonus.awsEnabled = false;
  c.expenses.monthly = 0; c.tax.mode = 'none'; c.savings.fixedMonthly = 0; c.savings.pctBonus = 0; c.savings.pctLump = 0;
  c.salary.promotions = []; c.profile.endAge = 35;
  return c;
}

describe('CPF contribution formula and rounding', () => {
  it('matches the published steps for $4,980 at 55 & below', () => {
    const r = cpfContribution(4980, 4980, 0, 37, 20);
    expect(r.total).toBe(1843);    // 1,842.60 rounded to nearest dollar
    expect(r.employee).toBe(996);  // 996.00, cents dropped
    expect(r.employer).toBe(847);  // total - employee
  });
  it('uses the $500-$750 phase-in formula', () => {
    const r = cpfContribution(600, 600, 0, 37, 20);
    expect(r.employee).toBe(60);   // 0.6 x (600 - 500)
    expect(r.total).toBe(162);     // 17% x 600 + 60
  });
});

describe('salary grades and ceiling lump sums', () => {
  it('caps basic at the grade ceiling and pays only the blocked portion in the crossing year', () => {
    const c = quiet(); c.salary.startBasic = 7600; // S2 max 7,840
    const res = simulate(c);
    const nov27 = at(res.months, '2027-11');
    close(nov27.basic, 7840);
    close(nov27.blockedMonthly, 7600 * 1.04 - 7840); // 64.00
    close(nov27.lump, 64 * 12);
  });
  it('pays a fresh, non-compounding lump sum each capped year', () => {
    const c = quiet(); c.salary.startBasic = 7840;
    const res = simulate(c);
    const l = ['2027-11', '2028-11', '2029-11'].map(ym => at(res.months, ym));
    for (const r of l) { close(r.basic, 7840); close(r.lump, 7840 * 0.04 * 12); }
    close(at(res.months, '2029-12').basic, 7840); // basic never rises past the ceiling
  });
  it('pays nothing under the "none" policy', () => {
    const c = quiet(); c.salary.startBasic = 7840; c.salary.lumpSum.policy = 'none';
    expect(simulate(c).months.every(r => r.lump === 0)).toBe(true);
  });
});

describe('promotion and increment in the same month', () => {
  const base = () => { const c = quiet(); c.salary.startBasic = 7700; c.salary.promotions = [{ id: 'x', ym: '2027-11', toGrade: 'S3', amount: 450 }]; return c; };
  it('default: increment first, tested against the new grade ceiling, so no lump sum', () => {
    const r = at(simulate(base()).months, '2027-11');
    close(r.basic, 7700 * 1.04 + 450); expect(r.lump).toBe(0); expect(r.grade).toBe('S3');
  });
  it('sequential ceiling: increment capped by the old grade, lump sum paid, then promotion', () => {
    const c = base(); c.salary.sameMonthCeiling = 'sequential';
    const r = at(simulate(c).months, '2027-11');
    close(r.basic, 7840 + 450); close(r.lump, (7700 * 1.04 - 7840) * 12);
  });
  it('promotion first: increment applies to the promoted salary', () => {
    const c = base(); c.salary.order = 'promotion-first';
    const r = at(simulate(c).months, '2027-11');
    close(r.basic, (7700 + 450) * 1.04); expect(r.lump).toBe(0);
  });
  it('default timeline gives S3 at 4,980 x 1.04^2 + 450 in Nov 2028', () => {
    const r = at(simulate(defaultConfig()).months, '2028-11');
    close(r.basic, 4980 * 1.04 ** 2 + 450); expect(r.grade).toBe('S3');
  });
});

describe('allowances, bonus and AWS', () => {
  it('replaces $400 with $800 rather than adding', () => {
    const res = simulate(defaultConfig());
    expect(at(res.months, '2032-10').allowance).toBe(400);
    expect(at(res.months, '2032-11').allowance).toBe(800);
  });
  it('bonus basis follows the per-allowance switch', () => {
    const on = defaultConfig(); const off = clone(on); off.allowances.forEach(a => (a.bonus = false));
    const rOn = at(simulate(on).months, '2029-03'), rOff = at(simulate(off).months, '2029-03');
    close(rOn.bonus, 4 * (rOn.basic + 400)); close(rOff.bonus, 4 * rOff.basic);
  });
  it('AWS switch removes the 13th month', () => {
    const c = defaultConfig(); c.bonus.awsEnabled = false;
    expect(simulate(c).months.every(r => r.aws === 0)).toBe(true);
  });
});

describe('partial years', () => {
  it('treats Nov-Dec 2026 as two months and prorates the first AWS', () => {
    const res = simulate(defaultConfig());
    const y26 = res.years[0];
    expect(y26.year).toBe(2026); expect(y26.months).toBe(2);
    close(y26.salary, 2 * 4980);
    close(at(res.months, '2026-12').aws, 4980 * 4 / 12); // employed Sep-Dec 2026
    close(at(res.months, '2027-03').bonus, 4 * 4980 * 4 / 12); // bonus for 2026, employed 4 months
    close(at(res.months, '2028-03').bonus, 4 * at(res.months, '2028-03').basic * 1 + 4 * 400); // full year from 2028
  });
});

describe('CPF wage ceilings', () => {
  it('limits OW to $8,000 a month and AW to $102,000 less OW for the year', () => {
    const c = quiet(); c.salary.grades.push({ id: 'X', min: 0, max: 99999 }); c.salary.startGrade = 'X';
    c.salary.startBasic = 9000; c.salary.incRate = 0; c.bonus.months = 20; c.bonus.payMonth = 3; c.bonus.reference = 'trailing-12';
    c.bonus.employmentStart = '2020-01';
    const res = simulate(c);
    const y = res.years.find(y => y.year === 2027)!;
    close(y.owSub, 96000); close(y.awSub, 6000);
    const mar = at(res.months, '2027-03');
    expect(mar.gross).toBeCloseTo(9000 + 20 * 9000, 6); // cash pay is never capped
    expect(mar.totalCPF).toBe(Math.round(0.37 * (8000 + 6000)));
  });
});

describe('PR phases and age bands', () => {
  it('moves through graduated SPR rates', () => {
    const c = quiet(); c.cpf.status = 'pr'; c.cpf.prDate = '2026-10'; c.cpf.prScheme = 'GG';
    const res = simulate(c);
    const n26 = at(res.months, '2026-11'), n27 = at(res.months, '2027-11'), n28 = at(res.months, '2028-11');
    expect(n26.cpfPhase).toBe('pr1'); expect(n26.totalCPF).toBe(Math.round(0.09 * 4980)); expect(n26.employeeCPF).toBe(Math.floor(0.05 * 4980));
    expect(n27.cpfPhase).toBe('pr2'); expect(n27.totalRate).toBe(24);
    expect(n28.cpfPhase).toBe('full'); expect(n28.totalRate).toBe(37);
  });
  it('changes age band the month after the 55th birthday', () => {
    const c = quiet(); c.profile.birthDate = '1972-03-10'; c.profile.endAge = 56;
    const res = simulate(c);
    expect(at(res.months, '2027-03').totalRate).toBe(37);
    expect(at(res.months, '2027-04').totalRate).toBe(35.5); // 2027 rate table, above 55-60
  });
});

describe('CPF interest', () => {
  it('accrues monthly on the lowest balance and credits once a year', () => {
    const c = quiet(); c.cpf.startOA = 12000; c.salary.startBasic = 0;
    const res = simulate(c);
    const nov = at(res.months, '2026-11'), dec = at(res.months, '2026-12');
    close(nov.accOA, 12000 * 0.025 / 12); close(nov.accSA, 12000 * 0.01 / 12); // extra interest on OA goes to SA
    expect(nov.oa).toBe(12000); // nothing posted mid-year
    close(dec.cpfInterestCredited, 2 * 12000 * 0.035 / 12);
    close(dec.oa, 12000 + 50); close(dec.sa, 20);
  });
  it('does not pay interest on a contribution in the month it is credited', () => {
    const c = quiet();
    const dec = at(simulate(c).months, '2026-12');
    expect(dec.cpfCredited).toBe(1843); // Nov wages credited in Dec
    close(dec.cpfInterestCredited, 0);  // lowest Dec balance was zero
  });
});

describe('MediSave overflow', () => {
  it('sends contributions above the BHS to SA', () => {
    const c = quiet(); c.cpf.startMA = 79000;
    const res = simulate(c); const dec = at(res.months, '2026-12'), nov = at(res.months, '2026-11');
    expect(dec.ma).toBeCloseTo(79000, 6);
    // Nov contribution's MA share overflows to SA; so does Dec's credited MA interest
    // (2 months x [79,000 x 4% + 60,000 x 1% extra] / 12), because MA is already at the BHS.
    const maInterest = 2 * (79000 * 0.04 + 60000 * 0.01) / 12;
    close(dec.sa, nov.allocSA + nov.allocMA + maInterest);
  });
  it('sends overflow to OA once SA holds the current FRS', () => {
    const c = quiet(); c.cpf.startMA = 79000; c.cpf.startSA = 230000;
    const dec = at(simulate(c).months, '2026-12'), nov = at(simulate(c).months, '2026-11');
    expect(dec.oa).toBeGreaterThan(nov.allocOA + nov.allocMA - 1);
  });
});

describe('age 55 transition', () => {
  it('forms the RA from SA then OA up to the FRS and closes SA', () => {
    const c = quiet(); c.profile.birthDate = '1971-12-15'; c.profile.endAge = 56;
    c.cpf.startSA = 250000; c.cpf.startOA = 50000;
    const res = simulate(c);
    const a = res.age55!;
    expect(a.month).toBe('2026-12');
    expect(a.after.ra).toBe(220400); expect(a.after.sa).toBe(0);
    close(a.after.oa, a.before.oa + (a.before.sa - 220400));
    close(a.before.oa + a.before.sa + a.before.ra, a.after.oa + a.after.sa + a.after.ra);
  });
});

describe('withdrawals', () => {
  it('never takes OA or MA below zero and records the shortfall', () => {
    const c = quiet(); c.cpf.startOA = 1500; c.cpf.startMA = 100;
    c.cpf.housing = [{ id: 'h', from: '2026-11', to: '2027-12', monthly: 1000 }];
    c.cpf.medical = [{ id: 'm', from: '2026-11', to: '2026-12', monthly: 300 }];
    const res = simulate(c);
    expect(res.months.every(r => r.oa >= -1e-9 && r.ma >= -1e-9)).toBe(true);
    expect(at(res.months, '2026-11').housing).toBe(1000);
    expect(at(res.months, '2026-11').medical).toBe(100);
  });
});

describe('savings products', () => {
  it('places, matures and renews an FD with principal plus interest', () => {
    const c = quiet(); c.savings.fixedMonthly = 1000; c.savings.alloc = { cash: 0, fd: 1, ssb: 0, fund: 0 };
    c.savings.fd = { ...c.savings.fd, rate: 0.02, renewRate: 0.01, min: 1000, tenure: 12, renewal: 'principal+interest', compounding: 'simple' };
    const res = simulate(c);
    expect(at(res.months, '2026-11').fdPrincipal).toBeCloseTo(1000, 6);
    const nov27 = at(res.months, '2027-11');
    expect(nov27.events.some(e => e.startsWith('FD matured'))).toBe(true);
    // 12 placements of 1,000 by Oct 2027 + 1,020 renewed + the Nov 2027 placement
    close(nov27.fdPrincipal, 11000 + 1020 + 1000);
  });
  it('reinvests bond coupons only when enabled', () => {
    const mk = (reinvest: boolean) => {
      const c = quiet(); c.savings.startCash = 20000; c.savings.reinvestCoupons = reinvest; c.savings.cash.rate = 0;
      c.savings.bonds = [{ id: 'b', label: 'SGS 3% 2029', buyYM: '2026-11', face: 10000, pricePer100: 100, couponPct: 3, couponsPerYear: 2, maturityYM: '2028-11', marketYieldPct: 3 }];
      return simulate(c);
    };
    const yes = mk(true), no = mk(false);
    close(at(yes.months, '2027-05').cash, 10000 + 150);
    close(at(no.months, '2027-05').cash, 10000);
    close(no.ledger.savings.payouts, 4 * 150);
    close(at(yes.months, '2028-11').cash, 20000 + 4 * 150); // face returned at maturity
  });
  it('pays SSB coupons from the issue schedule', () => {
    const c = quiet(); c.savings.startCash = 0; c.savings.fixedMonthly = 1002; c.savings.alloc = { cash: 0, fd: 0, ssb: 1, fund: 0 }; c.savings.ssb.feePerPurchase = 2;
    const res = simulate(c);
    expect(at(res.months, '2026-11').ssbFace).toBe(1000);
    // first tranche issued Dec 2026, first coupon Jun 2027 at year-1 rate 1.67%
    close(res.ledger.savings.earnings >= 0 ? at(res.months, '2027-06').cash : 0, 1000 * 0.0167 / 2 + 0, 0.01);
  });
});

describe('conservation of money', () => {
  const check = (c: Config) => {
    const res = simulate(c); const L = res.ledger;
    close(L.cpf.posted, L.cpf.start + L.cpf.contributions + L.cpf.voluntary + L.cpf.interestCredited - L.cpf.withdrawals, 0.01);
    const s = L.savings;
    close(s.book, s.start + s.contributions + s.deposits + s.swept + s.earnings - s.withdrawals - s.payouts - s.fees, 0.01);
    // every month: total assets = CPF + savings, with no double counting
    for (const r of res.months) close(r.totalAssets, r.cpfTotal + r.portfolioValue, 1e-6);
    return res;
  };
  it('reconciles the default scenario', () => { check(defaultConfig()); });
  it('reconciles a busy scenario with withdrawals, top-ups, transfers, bonds, a fund shock and an age-55 transition', () => {
    const c = defaultConfig(); c.profile.birthDate = '1975-02-20'; c.profile.endAge = 60;
    c.cpf.startOA = 60000; c.cpf.startSA = 90000; c.cpf.startMA = 70000;
    c.cpf.housing = [{ id: 'h', from: '2027-01', to: '2035-12', monthly: 1200 }];
    c.cpf.medical = [{ id: 'm', from: '2027-01', to: '', monthly: 80 }];
    c.cpf.voluntary = [{ id: 'v', ym: '2027-01', account: 'SA_RA', amount: 8000, repeatYearly: true, until: '' }];
    c.cpf.transfers = [{ id: 't', ym: '2028-06', amount: 5000, repeatYearly: true, until: '2031-06' }];
    c.savings.alloc = { cash: 0.25, fd: 0.25, ssb: 0.25, fund: 0.25 }; c.savings.fund.shockYM = '2030-03'; c.savings.fund.shockPct = 12;
    c.savings.leftover = 'sweep';
    c.savings.oneOffs = [{ id: 'o', ym: '2031-01', amount: -40000, note: 'renovation' }, { id: 'o2', ym: '2029-05', amount: 5000, note: 'gift' }];
    c.savings.bonds = [{ id: 'b', label: 'SGS bond', buyYM: '2029-06', face: 5000, pricePer100: 98, couponPct: 2.8, couponsPerYear: 2, maturityYM: '2034-06', marketYieldPct: 3.2 }];
    c.expenses.monthly = 3500;
    const res = check(c);
    expect(res.age55).not.toBeNull();
  });
});

describe('tax', () => {
  it('applies resident rates YA 2024 onwards', () => {
    expect(residentTax(20000)).toBe(0);
    close(residentTax(40000), 550);
    close(residentTax(80000), 3350);
    close(residentTax(120000), 7950);
  });
});
