/**
 * CSV import/export facade (Plan §4.1). Pure serialisation is in `@/core/csv`;
 * this package adds the browser wiring (download trigger, file read) and the
 * shared `<ExportButton>` / `<CsvImportPanel>` UI.
 */
export { toCsv, parseCsv, type CsvColumn } from '@/core/csv'
export {
  recordsToSheet,
  type XlsxSheet,
  type XlsxCell,
  type RecordsToSheetOptions,
} from '@/core/xlsx'
export { downloadText, downloadBlob, downloadCsv, readFileText } from './download'
export { buildXlsx, downloadXlsx } from './xlsx'
export { ExportButton, type ExportButtonProps } from './ExportButton'
export { CsvImportPanel, type CsvImportPanelProps } from './CsvImportPanel'
