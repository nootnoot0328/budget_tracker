// Public surface of the projection engine used by Budget Margin's Future tab.
export { simulate, frsFor, bhsFor, isFrsProjected, phaseLabel } from './simulate';
export type { Result, MonthRow, YearRow, Age55, Milestone } from './simulate';
export { defaultConfig, clone } from './config';
export type { Config } from './config';
export { SOURCES, VERIFIED_ON, ALLOCATION, inForce, allocationBand } from './rules';
export { parseYM, fmtYM, labelYM, parseDate, bandAge, ageAtStart, mi, yearOf, monthOf } from './calendar';
