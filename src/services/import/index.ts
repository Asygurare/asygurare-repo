/**
 * Barrel export for the file-import service.
 *
 * Usage:
 *   import { parseFile, buildAutoMapping, transformAndInsert } from '@/src/services/import'
 */

export { parseFile } from './parsers'
export { buildAutoMapping } from './mapper'
export { transformAndInsert, buildPreviewRows } from './transformer'
export { getFieldsForEntity, LEAD_FIELDS, CUSTOMER_FIELDS } from './schemas'
