// ─── WhatsApp Business — Bausteine für die Oberfläche (07.10.2026) ──────────────────────────────────────────────────────
// Zum Einhängen in der Inbox (Gesprächsansicht, wenn `gespraech.quelle === 'whatsapp'`; das Gespräch trägt `whatsapp: { nummer,
// fenster, profilname? }` aus GET /api/inbox bzw. /api/inbox/gespraech):
//   <FensterUhr fenster={g.whatsapp.fenster} />                         Uhr für das 24-h-Fenster (Kopf des Gesprächs / Zeile, `kompakt`)
//   <WhatsappAntwort gespraech={g.id} fenster={g.whatsapp.fenster} />   Antworten: frei bei offenem Fenster, sonst Vorlage (Einzelklick)
//   <VorlagenWaehler gespraech={g.id} onGesendet={…} />                 nur der Vorlagen-Wähler (z. B. für „Nachfassen“)
//   <WhatsappKarte />                                                   Verbinden-/Status-Karte (Verbindungen)
// Medien einer Nachricht: Anhang `teil: 'wa'` → Download über GET /api/whatsapp/medien?id=<Nachrichten-Kennung> (nicht /api/inbox/anhang).
// Gelesen/Erledigt/Später/Zuordnen laufen über den gewohnten Weg POST /api/inbox (lib/inbox/aktionen.ts kennt WhatsApp).

export { FensterUhr, fensterJetzt } from './FensterUhr';
export { VorlagenWaehler } from './VorlagenWaehler';
export { WhatsappAntwort } from './WhatsappAntwort';
export { WhatsappKarte } from './WhatsappKarte';
