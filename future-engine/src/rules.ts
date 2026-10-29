// Official CPF / IRAS / MAS figures used by the engine.
// Every number here was checked against the cited source on VERIFIED_ON.
// Nothing here is guaranteed to hold beyond its stated effective period.

export const VERIFIED_ON = '2026-10-29';

export interface Source { id: string; title: string; url: string; covers: string; effective: string }

export const SOURCES: Source[] = [
  { id: 'rates2026', title: 'CPF contribution rate tables from 1 Jan 2026 (Tables 1-5, incl. SPR graduated rates)', url: 'https://www.cpf.gov.sg/service/sfc/servlet.shepherd/document/download/069IW00000DuRCiYAN', covers: 'Total and employee rates by age and wage band; rounding steps; OW ceiling $8,000', effective: 'From 1 Jan 2026' },
  { id: 'rates2027', title: 'CPF: changes to contribution rates for senior workers from 1 Jan 2027', url: 'https://www.cpf.gov.sg/service/article/what-are-the-changes-to-the-cpf-contribution-rates-for-senior-workers-that-will-take-effect-from-1-january-2027', covers: 'Above 55-60: 16.5% / 19%; above 60-65: 13% / 13%; increase goes to RA up to FRS', effective: 'From 1 Jan 2027' },
  { id: 'alloc2026', title: 'CPF allocation rates from 1 Jan 2026', url: 'https://www.cpf.gov.sg/service/sfc/servlet.shepherd/document/download/069IW000005qFrJYAU', covers: 'Allocation ratios by age; MA computed first, then SA/RA, OA is remainder', effective: 'From 1 Jan 2026' },
  { id: 'alloc2027', title: 'CPF allocation rates from 1 Jan 2027', url: 'https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/jan2027cpfallocationrates.pdf', covers: 'Allocation ratios by age from 2027', effective: 'From 1 Jan 2027' },
  { id: 'awceiling', title: 'CPF examples: computing the Additional Wage ceiling (2026)', url: 'https://www.cpf.gov.sg/service/sfc/servlet.shepherd/document/download/069IW00000MoFDuYAN', covers: 'AW ceiling = $102,000 - total OW subject to CPF for the year', effective: '2026' },
  { id: 'ceilings', title: 'CPF: contribution changes from 1 Jan 2026 (annual salary ceiling, CPF Annual Limit)', url: 'https://www.cpf.gov.sg/conrate2023', covers: 'Annual salary ceiling $102,000; CPF Annual Limit $37,740', effective: 'From 1 Jan 2026' },
  { id: 'ageband', title: 'CPF FAQ: when contribution rates change at 55, 60, 65, 70', url: 'https://ask.gov.sg/cpf/questions/cmrzlla6s00004d0163v25975', covers: 'New age-band rates apply from the month after the birthday month', effective: 'Current' },
  { id: 'interest', title: 'CPF interest rates 1 Oct - 31 Dec 2026; 4% SMRA floor extended to 31 Dec 2027', url: 'https://www.cpf.gov.sg/member/infohub/news/news-releases/government-extends-4-per-cent-interest-rate-floor-on-special-medisave-and-retirement-account-monies-until-31-december-2027', covers: 'OA 2.5%, SA/MA/RA 4%; extra interest tiers', effective: 'Q4 2026; floor to end-2027' },
  { id: 'extra', title: 'CPF FAQ: how much extra interest can I earn', url: 'https://www.cpf.gov.sg/service/article/how-much-extra-interest-can-i-earn-on-my-cpf-savings', covers: 'Extra interest tiers, $20,000 OA cap, order RA, OA, SA, MA; OA extra goes to SA/RA', effective: 'Current' },
  { id: 'bhs', title: 'CPF: interest rates Jan-Mar 2026 and Basic Healthcare Sum for 2026', url: 'https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-january-to-31-march-2026-and-basic-healthcare-sum-for-2026', covers: 'BHS $79,000 for members below 65 in 2026; fixed at 65', effective: '2026' },
  { id: 'overflow', title: 'CPF: why MediSave savings above the BHS overflow to SA/RA', url: 'https://cpf.gov.sg/member/infohub/cpf-clarifies/policy-faqs/after-i-have-met-the-basic-healthcare-sum-why-do-the-excess-medisave-account', covers: 'Excess MA contributions go to SA/RA up to FRS, then OA', effective: 'Current' },
  { id: 'frs', title: 'MOF Budget 2022 Annex E-3: retirement sums for cohorts turning 55 in 2023-2027', url: 'https://www.mof.gov.sg/docs/librariesprovider3/budget2022/download/pdf/annexe3.pdf', covers: 'BRS rising 3.5% a year to 2027 cohort (FRS = 2 x BRS): FRS $220,400 (2026), $228,200 (2027)', effective: 'Cohorts to 2027' },
  { id: 'ssb', title: 'MAS: Singapore Savings Bond GX26110X (Nov 2026 issue)', url: 'https://www.mas.gov.sg/-/media/mas/sgs/sgs-announcements-pdf/ssb-pdf/2026/gx26110x-eapps.pdf', covers: 'Coupon schedule, $500 denomination, $200,000 holding limit, redemption at face + accrued interest', effective: 'Issued 2 Nov 2026' },
  { id: 'tax', title: 'IRAS: individual income tax rates (resident, YA 2024 onwards)', url: 'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates', covers: 'Progressive resident rates 0% to 24%', effective: 'YA 2024 onwards' },
];

/** Contribution age bands: 0 = 55 & below, 1 = >55-60, 2 = >60-65, 3 = >65-70, 4 = >70. */
export function contributionBand(bandAge: number): number {
  if (bandAge < 55) return 0;
  if (bandAge < 60) return 1;
  if (bandAge < 65) return 2;
  if (bandAge < 70) return 3;
  return 4;
}
/** Note: "55 & below" covers the month of the 55th birthday; bandAge is the age at the end of the
 *  previous month, so bandAge 55 first appears in the month after the 55th birthday month. */

/** [total %, employee %] for wages > $750, full rates (citizens / SPR 3rd year+). */
export type RateRow = [number, number];
export const FULL_RATES: { from: string; rows: RateRow[] }[] = [
  { from: '2026-01', rows: [[37, 20], [34, 18], [25, 12.5], [16.5, 7.5], [12.5, 5]] },
  { from: '2027-01', rows: [[37, 20], [35.5, 19], [26, 13], [16.5, 7.5], [12.5, 5]] },
];
/** Graduated employee rates for SPR year 1 / year 2 (G/G). Unchanged since 2016. Band 4 (>70) uses band 3 values. */
export const GG_RATES: Record<1 | 2, RateRow[]> = {
  1: [[9, 5], [9, 5], [8.5, 5], [8.5, 5], [8.5, 5]],
  2: [[24, 15], [18.5, 12.5], [11, 7.5], [8.5, 5], [8.5, 5]],
};

/** Allocation ratios (share of total contribution): [MA, SA-or-RA]; OA = remainder. 8 age bands. */
export function allocationBand(bandAge: number): number {
  if (bandAge < 35) return 0;
  if (bandAge < 45) return 1;
  if (bandAge < 50) return 2;
  if (bandAge < 55) return 3;
  if (bandAge < 60) return 4;
  if (bandAge < 65) return 5;
  if (bandAge < 70) return 6;
  return 7;
}
export const ALLOCATION: { from: string; rows: [number, number][] }[] = [
  { from: '2026-01', rows: [[0.2162, 0.1621], [0.2432, 0.1891], [0.2702, 0.2162], [0.2837, 0.3108], [0.3088, 0.3382], [0.42, 0.44], [0.6363, 0.303], [0.84, 0.08]] },
  { from: '2027-01', rows: [[0.2162, 0.1621], [0.2432, 0.1891], [0.2702, 0.2162], [0.2837, 0.3108], [0.2957, 0.3661], [0.4038, 0.4615], [0.6363, 0.303], [0.84, 0.08]] },
];

/** Announced retirement sums (cohort turning 55 in that year). */
export const FRS_ANNOUNCED: Record<number, number> = { 2026: 220400, 2027: 228200 };
export const BHS_ANNOUNCED: Record<number, number> = { 2026: 79000 };

/** Singapore resident tax brackets, YA 2024 onwards: [upper bound of band, marginal rate]. */
export const TAX_BRACKETS: [number, number][] = [
  [20000, 0], [30000, 0.02], [40000, 0.035], [80000, 0.07], [120000, 0.115], [160000, 0.15],
  [200000, 0.18], [240000, 0.19], [280000, 0.195], [320000, 0.2], [500000, 0.22], [1000000, 0.23], [Infinity, 0.24],
];

export function residentTax(chargeable: number): number {
  let tax = 0, lower = 0;
  for (const [upper, rate] of TAX_BRACKETS) {
    if (chargeable <= lower) break;
    tax += (Math.min(chargeable, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

/** SSB GX26110X coupon schedule (% p.a., years 1-10). */
export const SSB_NOV2026 = [1.67, 2.0, 2.19, 2.35, 2.49, 2.61, 2.7, 2.79, 2.91, 3.08];

/** Pick the table in force for a "YYYY-MM" month string (tables sorted by `from`). */
export function inForce<T extends { from: string }>(tables: T[], ym: string): T {
  let pick = tables[0];
  for (const t of tables) if (t.from <= ym) pick = t;
  return pick;
}
