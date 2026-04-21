/**
 * Shared bulk-import pipeline — single source of truth for warehouse CSV imports.
 *
 * Public surface re-exported here so consumers don't depend on internal paths.
 */
export { parseCSV, downloadCSV } from './csvParser';
export {
  resolveCategoryId,
  resolveUnitId,
  resolveLocationId,
  resolveSupplierId,
  resolveCompanyId,
  resolveBinId,
  parseNumber,
  parseBoolean,
  parseStatus,
} from './lookups';
export { allocateAutoCodes, type AllocatableRow, type AllocateOptions } from './autoCodeAllocator';
