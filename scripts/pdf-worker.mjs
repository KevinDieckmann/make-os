// Legt den pdf.js-Worker neben die Seite (public/), damit der Kontoauszug-Import
// ohne fremdes CDN läuft. Läuft nach jedem `npm install` (postinstall).
// Legacy-Build: funktioniert auch auf älteren iPhones (vor iOS 17.4).
import { copyFileSync, existsSync } from 'node:fs';
const quelle = 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs';
if (existsSync(quelle)) { copyFileSync(quelle, 'public/pdf.worker.min.mjs'); console.log('pdf.worker.min.mjs → public/'); }
else console.log('pdfjs-dist fehlt — Worker nicht kopiert');
