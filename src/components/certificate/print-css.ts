// Printing shows only the certificate, edge to edge on an A4 landscape sheet.
export const PRINT_CSS = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  body > :not(main) { display: none !important; }
  main { margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .no-print { display: none !important; }
  .cert-sheet { width: min(297mm, calc(210mm * var(--ar))) !important; margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; outline: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
