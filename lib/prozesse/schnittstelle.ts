// ─── Prozesse — die Schnittstelle des Moduls (Etappe B1, 21.10.; ANALYSE_100.md Punkt 100) ─────────────────────────────────────────────────────────────
// Prozesse sind ein eigenes Modul (`lib/prozesse/*`): gesteuert nur in MAKE OS (kein n8n, Zapier, Temporal), Modelle nur hinter dem KI-Tor. Werkstatt (B2)
// und Motor (C1) bauen NUR auf dieser Schnittstelle auf — rein und client-sicher; Server-Teile stehen in den `…-server.ts` (nur Server importieren):
//   lib/prozesse/werkstatt-server.ts   Bestände lesen/schreiben, Prüf-Kontext, aufgelöster Katalog, Auswahllisten, Konto löschen
//   lib/prozesse/webhook-server.ts     Schlüssel, Annehmen (offene Route), Frist, Eingang für einen Prompt (`fremd()`)
//   lib/prozesse/werkstatt-zugang.ts   Tor der Routen (Rechte der Person)
// Eine Instanz ohne Prozesse startet sauber: ohne Bestand liest alles leer, nichts läuft; die Fulfillment-Vorlagen gelten weiter (Brücke).

export * from './definition';
export { bedingungTrifft, bedingungenTreffen, bedingungText, bedingungenAus, BEDINGUNG_NAME } from './bedingung';
export {
  AUSLOESER_NAME, LOOP_NAME, PROZESS_EREIGNISSE, EREIGNIS_FELDER, FALL_FELDER, DATUMS_FELDER, ereignisStartetProzess, datumsFelderFuer, ausloeserFelder,
  ausloeserAus, webhookFelderAus, ereignisDaten, ausloeserPasst, startetNachLoop, ausloeserText, webhookFeldSchluessel, type FeldDef,
} from './ausloeser';
export {
  BAUSTEIN_KATALOG, KATALOG_KATEGORIEN, AUSWAHL_QUELLEN, QUELLEN_IM_PROZESS, FREIGABE_BAUSTEIN, FORM_KLASSE, KLASSE_RANG, FORMATIERER, PLATZHALTER_JE_FALL,
  TELEGRAM_HINWEISE, ABFRAGE_NAME, ZIELFELD_NAME, KARTE_FELDER, ROLLE_EIGNER, ROLLE_ZUSTAENDIG, ROLLEN_WERTE, GESELLSCHAFT_DES_FALLS, katalogEintrag, klasseVonEintrag, kategorienVonEintrag, brauchtSchloss, staerkste, maskeSaeubern, maskeVorgaben,
  formatieren, platzhalterFuer, textvorlagePruefen, textvorlageFuellen, katalogSelbstpruefung,
  type KatalogEintrag, type KatalogKategorie, type KatalogFeld, type MaskenFeld, type MaskenTyp, type MaskenKontext, type AuswahlQuelle, type FormatiererId,
} from './baustein-katalog';
export {
  MODELL_STUFEN, FACH_AGENTEN, ZOE_WERKZEUGE, WARUM_MIN, VERTRAG_KENNUNG, VERTRAG_LISTE_MAX, erlaubteWerkzeuge, headVonAgent, vertragAus, vertragPruefen, agentAus,
  ergebnisMussVorschlag, rechteProfil, agentSchlossGrund, agentText, type AgentKontext, type RechteProfil,
} from './agent-schritt';
export { modellOptionen, modellWahlAus, modellSchluessel, stufeVorgabe, type ModellOption } from './modell-wahl';
export { anspracheKanal, anspracheUrteil, type AnspracheUrteil } from './ansprache';
export { kinder, wurzel, phasen, schritteDer, alleSchritte, seitenZiele, schloesser, kantenVon, startKnoten, flussPruefen, type Kante, type Ausgang } from './fluss';
export { schlossKennung, schlossGrund, schlossSetzen, schlossFehlt, schlossText, type SchlossKontext } from './schloss';
export { definitionPruefen, knotenBefunde, aktivBefunde, laufFremd, rautenFelder, sperrtSpeichern, sperrtVeroeffentlichen, type PruefKontext } from './definition-pruefen';
export { veroeffentlichen, versionAlsEntwurf, versionenVergleichen, entwurfGeaendert, juengsteVersion, versionKurz, type Vergleich, type VersionErgebnis } from './versionen';
export { prozessRechte, laufPerson, KEINE_RECHTE, NUR_VOLLE_MITGLIEDER, type ProzessRechte, type RollenSicht, type TeamKurz } from './rollen';
export {
  prozesseAus, webhooksAus, definitionAus, eintragAus, knotenAus, leerProzesse, leerWebhooks, neuerProzess, werkstattAnwenden,
  type WerkstattKontext, type WerkstattErgebnis,
} from './bestand';
export {
  WEBHOOK_PFAD, SCHLUESSEL_FORM, WEBHOOK_UNBEKANNT, webhookAdresse, schluesselAusKopf, webhookAusloeserVon, koerperFiltern, webhookAnwenden, webhookKurz, annahmeLage,
  eingangAblegen, eingaengeFrist, type WebhookKontext, type WebhookErgebnis,
} from './webhook';
export { prozessAusFulfillment, kurzAusEintrag, kurzAusFulfillment, fulfillmentProzesse, type ProzessKurz } from './fulfillment-bruecke';
