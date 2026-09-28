# Brain auf dem Server — Plan (Kevin 29.09.2026)

**Kevins Frage:** „Kriegen wir es hin, eine Brain-Struktur auf dem Server zu integrieren, wo alle Daten sauber reinlaufen? Wir haben ja auch hier den Obsidian-Vault auf dem Mac — so dass wir das alles auf dem Server haben.“ → **Ja.** Der Server wird das Zuhause des Brain; der Mac-Vault wird eine Arbeitskopie.

## Zielbild
1. **Server-Vault ist die Wahrheit:** `/srv/make-os/vault` (Git-Repo auf dem Server), täglich zusätzlich nach GitHub (`make-vault`) und in die nächtliche Sicherung (die der Mac verschlüsselt abholt).
2. **Drei Bereiche im Vault:**
   - **Eure Notizen** (wie heute; nur Menschen schreiben, Obsidian am Mac oder später der Wiki-Editor in MAKE OS).
   - **`_App/` — Spiegel aus MAKE OS** (generiert, jede Nacht und nach wichtigen Ereignissen neu geschrieben, nie von Hand bearbeiten): Projekte mit Notizen, Mandate, Angebote, Entscheidungen/Freigaben, Zeit je Mandat, Wochenrückblick. Nur Kennungen/Links in die App, keine Art.-18-Kontakte, keine fremden privaten Notizen, keine IBAN; Privates nur, wenn der Haushalt es zulässt.
   - **`_inbox/` — Vorschläge von ZOE** (Konsolidierung, Regeln, Erkenntnisse) → ihr gebt frei, dann wandern sie in eure Notizen.
3. **Such-Index** über Vault **und** App-Bestände (FTS + Embeddings), eine Suche für ZOE und euch.
4. **Mac:** Vault raus aus dem iCloud-Schreibtisch (Git und iCloud vertragen sich nicht), z. B. `~/Vaults/MAKE`; Abgleich mit dem Server über Git (automatisch alle paar Minuten per launchd oder Obsidian-Git), Konflikte werden im HOI angezeigt.
5. **Datenschutz:** Art.-17-Verfahren auch für den Vault und seine Git-Historie dokumentiert; Personenbezug im Vault klein halten (Links statt Kopien).

## Schritte
1. (lokal, läuft) App → Brain-Brücke, `app_chunks`-Suche, Freigabe-Protokoll (Paket S2) — erweitert um den `_App/`-Spiegel.
2. (lokal) Klick-Anleitung „Vault vom iCloud-Schreibtisch holen + Abgleich am Mac“ (Kevin führt aus, Claude fasst den echten Vault nicht an).
3. (Server, erst auf Kevins Wort) Server-Vault als Wahrheit schalten, `_App/`-Spiegel aktivieren, Konflikt-Anzeige im HOI.

## Weitere Entscheidungen Kevin (29.09.)
- **Sicherung außer Haus:** der Mac holt jede Nacht das verschlüsselte Archiv ab (Pull, nur-lesender Zugang; Mac muss an sein — Hinweis im HOI, wenn älter als 48 h).
- **Kontakt-Kennungen:** auf zufällige Kennungen umstellen (Vorschau, Rückweg, Weiterleitung alter Links), erst lokal.
- **ZOE schreibt nur über den Stapel** (auch Notiz, Deal, Übergabe).
