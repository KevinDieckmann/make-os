// ─── Öffentliche Seiten — Kopfdaten ohne das Grundgerüst der Anwendung (30.10.) ───────────────────────────────────
// Check (/check) und Buchung (/buchen/…) laufen auch unter der Adresse einer Website (fokusinnovation.de leitet nur diese Pfade an
// die App). Sie dürfen deshalb nichts vom Wurzel-Layout erben, was die Anwendung nennt oder zeigt: Beschreibung, App-Titel fürs
// iPhone, Manifest, App-Icon — sonst stünde der Name der Software in Link-Vorschauen und im Quelltext. `null` hebt das Geerbte auf.

import type { Metadata } from 'next';

export const OEFFENTLICH_META = {
  description: null,
  manifest: null,
  appleWebApp: null,
  icons: null,
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
} satisfies Metadata;
