# fokusinnovation.de bei Google und KI-Suchen: was Kevin tun muss

Die Website ist technisch fertig für Google und für KI-Suchen wie ChatGPT, Perplexity und Gemini. Diese Schritte gehen nur mit deinen Konten. Sie sind nach Reihenfolge sortiert.

## Jetzt schon, auch während der Vorschau

1. **www-Adresse bei IONOS eintragen.** Unter fokusinnovation.de › DNS einen Eintrag anlegen:
   - Typ: A
   - Host: www
   - Ziel: 2.28.108.162

   Danach leitet www.fokusinnovation.de von selbst auf die Hauptadresse.
2. **Google Search Console anlegen.**
   - Auf search.google.com/search-console die Property „Domain“ mit `fokusinnovation.de` anlegen.
   - Google zeigt einen TXT-Eintrag (`google-site-verification=…`). Den bei IONOS unter DNS als Typ TXT, Host @, eintragen.
   - Nach ein paar Minuten in der Search Console auf „Bestätigen“ klicken.
3. **Bing Webmaster Tools.**
   - Auf bing.com/webmasters mit „Aus der Google Search Console importieren“ anmelden. Das sind zwei Klicks.
   - Wichtig: ChatGPT-Suche und Copilot greifen auf den Bing-Index zu.
4. **LinkedIn verknüpfen.** Schick mir den Link zu deinem LinkedIn-Profil, zu Malins Profil und, falls es sie gibt, zur Firmenseite. Ich trage sie in die strukturierten Daten ein (`sameAs`). So ordnen Google und KI-Suchen die Seite eindeutig euch zu.

## Wenn die Seite für Google freigegeben wird

5. **Check-Knöpfe klären.** Die Knöpfe „Innovations-Check“ führen noch auf die 404-Seite. Vor der Freigabe muss eines davon passieren:
   - Der Check läuft unter fokusinnovation.de/check.
   - Ich lenke die Knöpfe bis dahin auf die Seite zum Check um.
6. **Freigeben.** Sag mir „fokusinnovation.de für Google freigeben“. Dann stelle ich in einem Upload alles auf öffentlich:
   - `noindex` auf allen Seiten
   - die Sperre in robots.txt
   - der Kopf `X-Robots-Tag` auf dem Server
7. **Sitemap einreichen.**
   - In der Search Console unter „Sitemaps“ `https://fokusinnovation.de/sitemap.xml` einreichen.
   - In Bing ebenso.
   - Danach unter „URL-Prüfung“ die Startseite einmal „Indexierung beantragen“.
8. **Google-Unternehmensprofil (optional).**
   - Auf business.google.com ein Profil für „Fokus Innovation“ anlegen, als Dienstleister mit Einzugsgebiet. Dann wird die Adresse nicht öffentlich gezeigt, falls am Kurfürstendamm keine Kunden empfangen werden.
   - Google schickt zur Bestätigung meist eine Postkarte oder bittet um ein Video.

## Was die Seite schon mitbringt

- **Jede Seite:**
  - Titel und Beschreibung
  - Canonical
  - Vorschaubild für LinkedIn, WhatsApp und Google
  - strukturierte Daten: Firma mit Sitz Berlin und Gründern, Leistungen mit Preisen, Fragen und Antworten, Ratgeber mit Autor und Quellen, Begriffe, Preisliste
- **Für die Suchmaschinen:**
  - sitemap.xml mit allen 31 Seiten
  - robots.txt, das sich mit der Freigabe öffnet
  - llms.txt und llms-full.txt, damit KI-Assistenten die Seite richtig zusammenfassen
- **Neue Inhalte, die man finden kann:**
  - sechs Ratgeber, zum Beispiel „Vertrieb aufbauen“, „Head of Sales auf Zeit“ und „KI im Mittelstand einführen“
  - eine Preisseite
  - alle Fragen an einem Ort
  - 25 Begriffe von A bis Z
- **Schnell und ohne Fremdes:** keine Cookies, kein Tracking, keine fremden Dienste.

Hinweis: Wie schnell und wie weit oben Google und KI-Suchen die Seite zeigen, entscheiden die Anbieter. Versprechen kann das niemand. Gute Inhalte, Links von anderen Seiten (zum Beispiel aus LinkedIn-Beiträgen, Partnerseiten, Event-Ankündigungen) und Geduld helfen am meisten.
