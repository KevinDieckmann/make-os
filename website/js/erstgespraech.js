// MAKE Innovation · Landingpage: Knöpfe „Erstgespräch anfragen“ (v3, 01.10.2026)
// Das Ziel des Erstgesprächs steht an GENAU einer Stelle: im Knopf #erstgespraech-link (Abschnitt „Erstgespräch“,
// index.html) — heute eine vorbereitete Mail, später die Buchungsseite. Alle anderen Knöpfe tragen
// data-erstgespraech und zeigen ohne Skript auf #erstgespraech. Ist das Ziel gültig, übernimmt dieses Skript es für
// diese Knöpfe — ein Klick statt zwei. Speichert nichts, liest nichts aus, sendet nichts (website/pruefen.mjs prüft das).
const quelle = document.getElementById('erstgespraech-link');
const ziel = quelle ? quelle.getAttribute('href') || '' : '';
if (/^mailto:hello@makeinnovation\.de\?subject=/.test(ziel) || /^https:\/\/app\.makeinnovation\.de\/buchen\/[a-z0-9-]+$/.test(ziel)) {
  for (const a of document.querySelectorAll('a[data-erstgespraech]')) a.setAttribute('href', ziel);
}
