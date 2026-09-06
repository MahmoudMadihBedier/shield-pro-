/**
 * CSV import/export facade (Plan §4.1). Pure serialisation is in `@/core/csv`;
 * this package adds the browser wiring (download trigger, file read) and the
 * shared `<ExportButton>` / `<CsvImportPanel>` UI.
 */
export { toCsv, parseCsv, type CsvColumn } from '@/core/csv'
export { downloadText, downloadCsv, readFileText } from './download'
export { ExportButton, type ExportButtonProps } from './ExportButton'
export { CsvImportPanel, type CsvImportPanelProps } from './CsvImportPanel'
