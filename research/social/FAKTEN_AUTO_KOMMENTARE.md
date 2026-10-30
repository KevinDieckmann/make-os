# Fakten: Automatische Antworten und Kommentieren bei Fremden (Stand 29.10.2026)

Nur offizielle Primärquellen (Entwickler-Doku, Plattform-/API-Bedingungen, Community-Richtlinien, EU-Recht). Jede Aussage mit URL.
„nicht belegt“ = in der offiziellen Quelle nicht zu finden bzw. Seite war beim Abruf nicht lesbar; nie geraten.
Hinweis: Die Meta-Seiten `devpolicy` und `terms` lieferte der Abruf auf Deutsch; die Zitate sind deshalb deutsch bzw. sinngemäß.
Keine Rechtsberatung.

Gilt für: Instagram (Instagram API with Instagram Login, eigenes Professional-Konto), LinkedIn (Person, `w_member_social`), kurz TikTok, YouTube.

---

## 1. (A) Automatisch auf Kommentare unter EIGENEN Beiträgen antworten

### Instagram

| Fakt | Quelle |
|---|---|
| Antwort auf Kommentar: `POST /<IG_COMMENT_ID>/replies` mit `message`; Host bei Instagram Login `graph.instagram.com`. | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/comment-moderation |
| Scopes bei Instagram Login: `instagram_business_basic` + `instagram_business_manage_comments`. | dito |
| Standard Access reicht für Accounts, die man selbst besitzt/verwaltet und im App-Dashboard hinzugefügt hat; Advanced Access (App Review + Business Verification) nur für fremde Accounts. Eigenes Konto braucht keine App Review. | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/overview |
| Die Doku empfiehlt Webhooks (Feld `comments`), filtern gegen eigene Kriterien, dann per Kommentar-ID antworten. Das ist ausdrücklich als „Automate responses“-Muster beschrieben (so auf der Mentions-Seite; auf der Kommentar-Seite: Webhook-Empfehlung gegen Rate-Limiting, Batching mehrerer Antworten möglich). | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/mentions und comment-moderation (oben) |
| Zahlenmäßiges Limit nur für die Antwort-Route selbst: **nicht belegt** (Seite nennt keins). | comment-moderation (oben) |
| Allgemeines Instagram-Limit (Business Use Case): „Calls within 24 hours = 4800 * Number of Impressions“, je App + App-Nutzer-Paar; Fehlercode 80002. | https://developers.facebook.com/docs/graph-api/overview/rate-limiting |
| Private Reply auf einen Kommentar (DM an den Kommentierenden): innerhalb **7 Tage** nach dem Kommentar, **nur eine** Nachricht an den Kommentierenden; weitere Nachrichten nur, wenn er antwortet, dann innerhalb 24 h. Zulässig u. a. bei Kommentaren auf Posts, Reels, Stories, Live (nur während der Übertragung). | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/private-replies |
| Private-Reply-Limit: 750 Aufrufe/Stunde für Kommentare auf Posts/Reels; 100/Sekunde für Live-Kommentare (je Professional-Konto). | https://developers.facebook.com/docs/graph-api/overview/rate-limiting |
| Ob die Antwort-Route nur auf Top-Level-Kommentare beschränkt ist: **nicht belegt** (Seite sagt dazu nichts). | comment-moderation |
| Eine Regel „keine identischen/automatisierten Kommentarantworten“ steht nicht in der API-Doku. Sie steht in den Spam-Regeln (siehe 4); Wortlaut der Spam-Seite war beim Abruf nicht lesbar (JS-Seite), daher dort „nicht belegt“. | siehe Abschnitt 4 |

### LinkedIn

| Fakt | Quelle |
|---|---|
| Kommentieren per API: `POST /rest/socialActions/{shareUrn\|ugcPostUrn\|commentUrn}/comments`, auch verschachtelt (`parentComment`). | https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api |
| Berechtigung: `w_member_social_feed` („Post, comment, and react on posts on behalf of an authenticated member“); für Seiten `w_organization_social_feed`. Lesen für Personen (`r_member_social_feed`) ist „Restricted“, nur ausgewählten Entwicklern erteilt; `r_member_social` ist **geschlossen** („not accepting access requests“). | dito und https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview |
| **Share on LinkedIn** (`w_member_social`) ist laut Produktseite nur zum Erstellen von Posts beschrieben. Ob damit auch Kommentare möglich sind: **nicht belegt**. Die Comments-API führt eigene Scopes (`w_member_social_feed`), die zum Produkt „Community Management API“ (Vetted Product, Development- und Standard-Tier, Antrag + Screencast) gehören. | https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin ; community-management-overview |
| Die Doku führt „Profile Management: Create and manage posts, comments, and reactions … on behalf of individual profiles“ als Anwendungsfall. | community-management-overview |
| Limits: Development-Tier Community Management 500 Aufrufe/App, 100/Member pro Tag; Share on LinkedIn: 150/Member, 100.000/App pro Tag (UTC). Kommentar-Erstellung: 429 „creation rate limit exceeded for member“ = Kurzzeit-Limit pro Minute (Zahl **nicht belegt**). | community-management-overview ; share-on-linkedin ; comments-api |
| Rate-Limits werden nur in der Developer-Portal-Analytics-Seite je Endpunkt angezeigt, nicht veröffentlicht. | https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits |
| LinkedIn API Terms §3.1(26): verboten, „the Content or the APIs to automate posting on the LinkedIn Services“ zu nutzen. §4.3: Profil-Aktualisierungen nicht „on an automated schedule“. §3.1(20): API-Limits nicht umgehen. | https://www.linkedin.com/legal/l/api-terms-of-use |

### TikTok / YouTube (kurz)

| Fakt | Quelle |
|---|---|
| TikTok Developer-Scopes: kein Scope für Kommentare lesen/schreiben (nur Profil, `video.list`, `video.publish`, `video.upload`, Research, Portability). Kommentar-API in den Developer-Produkten: **nicht belegt**. | https://developers.tiktok.com/doc/tiktok-api-scopes ; https://developers.tiktok.com/doc/overview |
| TikTok „API for Business“ (Ads-Seite) beschreibt Organic API mit Accounts, Mentions, TikTok One, Discovery; Kommentar-Antwort-Endpunkt nur aus Drittquellen bekannt, offizielle Doku nicht gefunden: **nicht belegt**. | https://ads.tiktok.com/help/mobile/article?aid=11971 (per Suche; kein Kommentar-Modul genannt) |
| YouTube: `commentThreads.insert` legt Top-Level-Kommentar an, Scope `youtube.force-ssl`, Kontingent **50 Einheiten** je Aufruf (+2 mit `snippet`); Antworten auf Kommentare per `comments.insert`. | https://developers.google.com/youtube/v3/docs/commentThreads/insert |

---

## 2. (A) Automatische DM-Antworten

| Fakt | Quelle |
|---|---|
| Nachrichtenfenster: „For most user actions, it lasts 24 hours“; man darf erst schreiben, nachdem die Person dem Konto geschrieben hat. Nach Click-to-Direct-Anzeige bis zu 7 Tage. | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api |
| Human-Agent-Tag: separates **7-Tage-Fenster**, wenn ein Mensch mehr Zeit braucht. | dito ; https://developers.facebook.com/docs/messenger-platform/policy/policy-overview |
| Offenlegung automatisierter Chats: Wo gesetzlich gefordert, muss offengelegt werden, dass man mit einem automatisierten Dienst spricht, und zwar zu Beginn, nach längerer Pause und beim Wechsel Mensch → Automat. Besonders beachten: **Kalifornien und Deutschland**. Beispiel: „You are talking to a bot.“ Auch ohne gesetzliche Pflicht empfohlen („best practice“). | messaging-api (oben) ; messenger-platform/policy/policy-overview |
| Gilt für Instagram dieselbe Bot-Reaktionszeit-Regel (Antwort auf jede Eingabe binnen 30 s, Klassifizierung automated/manual/hybrid)? Die Messenger-Policy nennt sie; für Instagram **nicht ausdrücklich belegt**. | policy-overview |
| Developer Policy §5.2a: Personen nur im Messenger/Instagram Messaging kontaktieren, nachdem gültige Einwilligung eingeholt ist; §5.2b: dauerhafte Opt-out-Möglichkeit, Anträge umgehend beachten; §5.1: keine verwirrenden/sinnlosen Antworten; §5.4: Erlebnisse mit „übermäßig viel negativem Feedback“ können eingeschränkt oder entfernt werden; §5.6.2b: Spam „gemäß Definition in den Gemeinschaftsstandards“ nicht gestattet, einschl. übermäßiger Bot-Erstellung; §1.4: niemanden verwirren, täuschen oder spammen. | https://developers.facebook.com/devpolicy/ |
| Nachrichten-Tags/Verwaltungsnachrichten dürfen keine Werbeinhalte tragen (§5.6.2c). | devpolicy |
| Technik: Text ≤ 1.000 Byte (UTF-8); keine Gruppen; Requests-Ordner-Nachrichten > 30 Tage inaktiv werden nicht geliefert; Medien im Eigentum des App-Nutzers. Berechtigungen `instagram_business_basic` + `instagram_business_manage_messages`. | messaging-api (oben) |
| Limits Send API: 100 Aufrufe/s (Text, Links, Reaktionen, Sticker), 10/s (Audio/Video); Conversations API 2/s. | https://developers.facebook.com/docs/graph-api/overview/rate-limiting |
| Plattform-Bedingungen: Daten dürfen nur für die in der Doku genannten Zwecke verarbeitet werden (§3.a.viii); App wird regelmäßig überwacht, bei möglichem Verstoß Durchsetzung (§7.b, §7.e); Gesetze einhalten (§1.c, §11.b). Ein ausdrückliches „Bot muss sich offenlegen“ steht dort **nicht**. | https://developers.facebook.com/terms/ (deutsche Fassung) |

---

## 3. (B) Kommentieren unter FREMDEN Beiträgen per API

### Instagram

| Fakt | Quelle |
|---|---|
| `POST /<IG_ID>/mentions` antwortet nur auf einen Kommentar bzw. eine Bildunterschrift, in dem/der **unser Konto @erwähnt** wurde. `GET /<IG_ID>/tags` findet Medien, in denen wir getaggt sind. | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/mentions |
| Nicht unterstützt: Mentions in Stories; „Commenting on photos in which you were tagged is not supported.“ Webhooks kommen nicht, wenn das Medium von einem privaten Account stammt. | dito |
| Business Discovery ist **nur lesend** (öffentliche Metadaten/Metriken anderer Business/Creator-Accounts; GET auf Medienobjekte scheitert „due to insufficient permissions“). Es wird nur mit Facebook Login bzw. Unified Login unterstützt, nicht mit Instagram Login. Schreibweg für Kommentare ist dort nicht beschrieben. | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery ; Overview Instagram Login: „hashtag search“ nicht unterstützt |
| Ein dokumentierter Endpunkt, um **frei** unter beliebigen Beiträgen fremder Accounts zu kommentieren, ist in den gelesenen Instagram-Seiten **nicht vorhanden / nicht belegt**. Dokumentiert ist nur: auf eigene Medien (Kommentare) und auf Mentions antworten. | comment-moderation ; mentions ; overview |

### LinkedIn

| Fakt | Quelle |
|---|---|
| Die Comments-API nimmt eine beliebige Post-/Share-/Comment-URN als Ziel (`socialActions/{urn}/comments`); eine Einschränkung auf eigene Posts steht dort nicht. Technisch ist Kommentieren fremder Posts damit vorgesehen, **sofern** `w_member_social_feed` (Community Management API) freigegeben ist. | https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api |
| Rechtlich: User Agreement §8.2 verbietet Bots/automatisierte Methoden (siehe 4). API Terms §3.1(26) verbietet automatisiertes Posten über die API, §3.1 Nr. 10 „mass messages“, §3.1 Nr. 12 „abusive usage“. Ob automatisiertes Kommentieren per freigegebener Community-Management-API ausdrücklich erlaubt ist: **nicht belegt**. | https://www.linkedin.com/legal/user-agreement ; https://www.linkedin.com/legal/l/api-terms-of-use |
| Hilfeartikel: Software/Erweiterungen, die Aktivität automatisieren, sind nicht erlaubt; User Agreement §8.2 deckt ausdrücklich Tools ab, die Nachrichten senden oder Beiträge kommentieren; Konten können eingeschränkt oder geschlossen werden. | https://www.linkedin.com/help/linkedin/answer/a1341387 |

### YouTube

| Fakt | Quelle |
|---|---|
| `commentThreads.insert` funktioniert auf beliebigen Videos (videoId + channelId Pflicht), 50 Einheiten Kontingent. | https://developers.google.com/youtube/v3/docs/commentThreads/insert |
| Developer Policies III.C.2: Funktion, die eine YouTube-Aktion auslöst, muss „clearly initiated by the user“ sein; III.E.3.d: Veröffentlichen im Namen des Nutzers nur mit ausdrücklicher Einwilligung; III.I.2: nicht „automate or trigger views, uploads, comments, likes“ ohne vorherige, ausdrückliche Zustimmung; III.I.11: nicht „spam“. | https://developers.google.com/youtube/terms/developer-policies |

### TikTok

| Fakt | Quelle |
|---|---|
| Keine offizielle Kommentar-Schreib-API in den Developer-Scopes gefunden. | https://developers.tiktok.com/doc/tiktok-api-scopes |

---

## 4. Was laut Plattform-Regeln zu Einschränkung/Sperre führt

| Plattform | Fakt | Quelle |
|---|---|---|
| Instagram | Nutzungsbedingungen: man darf nicht versuchen, „access or collect information in unauthorized ways“; das umfasst automatisiertes Erstellen von Konten bzw. Sammeln von Informationen „in an automated way without our express permission“ (Suchtreffer-Wortlaut der Help-Center-Seite; die Seite selbst war direkt nicht voll lesbar). Gilt nach Wortlaut für **Konten und Datensammeln**, nicht ausdrücklich für Kommentare. | https://help.instagram.com/581066165581870 |
| Instagram/Meta | Community Standards „Spam“: Seite war beim Abruf nicht lesbar. Inhalte über Frequenz-/Wiederholungsregeln sind daher **nicht belegt** (Developer Policy §5.6.2b verweist auf diese Spam-Definition). | https://transparency.meta.com/policies/community-standards/spam/ |
| Meta Developer Policy | Spam „gemäß Definition in den Gemeinschaftsstandards“ nicht gestattet; Täuschung/Spam §1.4; negatives Feedback §5.4; Opt-out §5.2b. | https://developers.facebook.com/devpolicy/ |
| Meta Plattformbedingungen | Monitoring und Durchsetzung bei Verstoß; Zugriff kann bei 28 Tagen Nichtnutzung ausgesetzt werden (§7.e.iii). | https://developers.facebook.com/terms/ |
| LinkedIn | User Agreement §8.2 Nr. 13: nicht „bots or other unauthorized automated methods to access the Services“ nutzen; derselbe Punkt nennt auch das Automatisieren von Nachrichten und Posts sowie „inauthentic engagement“; Nr. 16: Manipulation von Algorithmen; Nr. 2: Scraping/Skripte. §3.4: LinkedIn darf die Nutzung begrenzen (z. B. Kontaktaufnahme) und Konten einschränken/sperren. | https://www.linkedin.com/legal/user-agreement |
| LinkedIn | Hilfe: Nutzer mit solchen Tools „risk having their accounts restricted or shut down“; Tools können ohne Ankündigung aufhören zu funktionieren. | https://www.linkedin.com/help/linkedin/answer/a1341387 |
| LinkedIn | API Terms: kein Umgehen/Überschreiten von API-Limits (§1.4, §3.1(20)), keine automatische Veröffentlichung via API (§3.1(26)). | https://www.linkedin.com/legal/l/api-terms-of-use |
| YouTube | Spam-Richtlinie: verboten sind „high-volume, repetitive, or deceptive comments“ zur Reichweitensteigerung; Beispiel: nahezu identische Werbenachrichten unter hunderten Videos; ebenso „Using automated tools or AI to churn out high volumes of similar content with minimal changes“. | https://support.google.com/youtube/answer/2801973 |
| TikTok | „We strictly prohibit automation tools, scripts, or other tricks designed to bypass our systems“ (Folge: Inhaltsentfernung, Kontosperre); Spam und inauthentische Metriken verboten. Kommentarspezifische Regeln im abgerufenen Teil nicht enthalten. | https://www.tiktok.com/community-guidelines/en/integrity-authenticity |

**Gilt das Verbot auch für die OFFIZIELLE API?**

| Fakt | Quelle |
|---|---|
| Meta: Die offizielle API sieht Automatisierung ausdrücklich vor (Webhook → filtern → antworten; Private Replies; Bot-Offenlegung wird geregelt). Das Verbot gilt für Automatisierung **außerhalb** der API („unauthorized ways“) und für Spam/Täuschung auch über die API (Developer Policy §1.4, §5.6.2b). | mentions ; messaging-api ; devpolicy |
| LinkedIn: Das Bot-Verbot (User Agreement §8.2) steht für die Nutzung der Dienste; die API Terms erlauben Automatisierung nur im Rahmen der Produkte, verbieten aber ausdrücklich „automate posting“ (§3.1(26)). Für automatisiertes **Kommentieren** über die offizielle API gibt es keine ausdrückliche Erlaubnis in den gelesenen Quellen: **nicht belegt**. | user-agreement ; api-terms-of-use |
| YouTube: API-Automatisierung von Kommentaren verlangt ausdrückliche Zustimmung/klare Auslösung durch den Nutzer; Spam-Richtlinie gilt unabhängig vom Weg. | developer-policies ; spam-policy |

---

## 5. EU-Recht: KI-Verordnung Art. 50

| Fakt | Quelle |
|---|---|
| Art. 50 Abs. 1: Anbieter stellen sicher, dass KI-Systeme, die für die direkte Interaktion mit natürlichen Personen bestimmt sind, so entworfen sind, dass die Personen **informiert werden, dass sie mit einem KI-System interagieren**; Ausnahme, wenn das aus Sicht einer angemessen informierten Person offensichtlich ist, sowie für gesetzlich erlaubte Strafverfolgung. | https://artificialintelligenceact.eu/article/50/ |
| Abs. 5: Information klar erkennbar, spätestens bei der ersten Interaktion bzw. Konfrontation. | dito |
| Anwendbar ab **2. August 2026** (allgemeine Anwendbarkeit; Transparenzregeln „in August 2026“). Das heißt: gilt zum heutigen Datum. | https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai ; artificialintelligenceact.eu/article/50 |
| Ein Aufschub durch das „AI Omnibus“ betrifft laut Kommissionsseite Hochrisiko-Systeme (Annex III bis 2.12.2027, Annex I bis 2.8.2028); für Art. 50 nennt die Seite **keinen** Aufschub. Sekundärquellen sprechen von einer Schonfrist nur für die Kennzeichnungspflicht nach Art. 50 Abs. 2 (nicht Abs. 1) – das ist hier nur aus Sekundärquellen und **nicht belegt**. | Kommissionsseite oben |
| Anwendung auf unsere Fälle: Automatische KI-Antworten in DMs sind direkte Interaktion mit einer Person, Abs. 1 greift (wir als Anbieter des Systems, der Kunde als Betreiber). Bei öffentlichen Kommentarantworten ist die Anwendbarkeit eine Auslegungsfrage; das Gesetz nimmt „Offensichtlichkeit“ aus: **Auslegung nicht aus Primärquelle belegt**. Sicherer Weg: Offenlegung immer. | eigene Schlussfolgerung aus Art. 50 Abs. 1 |
| Meta fordert Offenlegung ohnehin dort, wo das Gesetz es verlangt, und nennt Deutschland ausdrücklich. | messaging-api (oben) |

---

## 6. Best Practice, die sich aus den offiziellen Regeln ergibt

| Leitplanke | Begründung / Quelle |
|---|---|
| Nur auf eigene Beiträge und Konversationen automatisch antworten; fremde Beiträge nur mit Mensch-Klick (oder gar nicht). | Meta API-Rahmen (nur eigene Medien + Mentions); YouTube III.C.2 „clearly initiated by the user“; LinkedIn User Agreement §8.2 |
| Nie identische oder nahezu identische Texte; jede Antwort bezieht sich auf den konkreten Kommentar. | YouTube Spam-Richtlinie („repetitive“, „minimal changes“); Meta Spam-Verweis (Developer Policy §5.6.2b) |
| Tageslimits deutlich unter den API-Limits (Instagram Private Replies 750/h; LinkedIn 429 pro Minute; YouTube 50 Einheiten je Kommentar bei 10.000 Standard-Tageskontingent ist **nicht belegt**) und Pausen zwischen Antworten (menschliche Taktung). | rate-limiting ; comments-api ; commentThreads.insert |
| Offenlegung: in DMs zu Beginn jedes Threads („Ich bin ein KI-Assistent von …“), nach längerer Pause und beim Wechsel Mensch ↔ KI; Übergabe an einen Menschen anbieten. | Meta messaging-api ; AI Act Art. 50 Abs. 1 und 5 |
| Mensch bei Kritik, Beschwerde, Rechts-, Gesundheits-, Preis-, Vertragsfragen; unklar = nicht antworten, sondern an Mensch. | Developer Policy §5.1 (keine verwirrenden/sinnlosen Antworten), §5.4 (negatives Feedback) |
| Nur auf Fragen und echte Anliegen antworten, nicht auf jeden Kommentar (Emoji, Spam, Troll → ignorieren/verbergen). | Developer Policy §5.6.2b ; YouTube Spam-Richtlinie |
| Kein Werbetext in DM-Antworten außerhalb des Standardfensters; Tags nur für ihren Zweck. | Developer Policy §5.6.1b, §5.6.2c |
| Opt-out („STOP“) sofort beachten, Gespräch beenden. | Developer Policy §5.2b |
| Antwort-Webhook statt Polling; Doppel-Zustellungen idempotent behandeln. | comment-moderation ; https://developers.facebook.com/docs/instagram-platform/webhooks |
| Freigabe-Modus als Standard, Auto-Modus nur zuschaltbar mit Schwellen (Konfidenz, Kategorien), Not-Aus, Protokoll jeder Antwort. | Ableitung aus den Regeln (YouTube III.E.3.d, Meta Developer Policy §7 Monitoring) |
| LinkedIn: wegen §8.2 / §3.1(26) für Kommentare nur Entwurf + Klick. | LinkedIn User Agreement / API Terms |

---

## Folgen für den Bau

1. **Instagram A, Kommentare unter eigenen Beiträgen automatisch:** machbar mit den vorhandenen Scopes über Webhook `comments` → Agent → `POST /{comment-id}/replies`. Standard Access genügt für das eigene Konto. Leitplanken in Code: Kategorienfilter (nur Fragen/Anliegen), kein Wiederholungstext (Ähnlichkeitsprüfung gegen die letzten N Antworten), Mindestabstand, Tageslimit, Mensch bei Kritik, Protokoll, Not-Aus.
2. **Instagram A, DMs automatisch:** machbar, aber **nur im 24-h-Fenster** nach der Nachricht der Person (Human-Agent-Tag 7 Tage nur für manuelle Antwort durch einen Menschen). Bot-Offenlegung im ersten Satz (und bei Wiederaufnahme nach Pause), Übergabe-Option, Opt-out, 1.000-Byte-Grenze, keine Werbung. Private Reply auf Kommentar: einmal je Kommentierendem, 7 Tage, 750/h.
3. **Instagram B, Kommentieren bei Fremden:** über die dokumentierte API **nicht möglich**, außer Antwort auf Kommentare/Captions, in denen wir erwähnt werden (`/mentions`). Business Discovery ist nur lesend (und mit Instagram Login nicht verfügbar). Nicht über Browser-Bots/Scraping lösen. Machbar: Nischen-Recherche als Vorschlagsliste, Kommentar schreibt der Mensch selbst in der App (Textvorschlag in die Zwischenablage / Deep Link zum Beitrag).
4. **LinkedIn A:** Kommentare unter eigenen Posts nur mit `w_member_social_feed` (Community Management API, Antragsverfahren; reines `w_member_social` aus „Share on LinkedIn“ deckt es nicht belegt ab). Lesen der Kommentare zu Personenposts ist eingeschränkt (`r_member_social_feed` nur ausgewählten Entwicklern). Rechtlich ungeklärt (API Terms §3.1(26), User Agreement §8.2): **als Entwurf mit Klick bauen, nicht vollautomatisch.**
5. **LinkedIn B:** technisch sieht die Comments-API fremde Posts vor, aber Zugriff, Lesbarkeit und AGB-Risiko sprechen dagegen. Als Funktion „Kommentar-Vorschlag, Mensch sendet“.
6. **YouTube:** nur kurz: `commentThreads.insert` geht auf fremde Videos (50 Einheiten), aber Spam-Richtlinie + III.C.2 verlangen klare Auslösung durch den Nutzer. Gleiches Muster wie LinkedIn.
7. **TikTok:** keine Kommentar-API in den Developer-Scopes → nichts automatisieren.
8. **Modus je Kanal als Einstellung:** `aus | Vorschlag | Auto (nur eigene Beiträge/DMs)`; Fremdkommentare nur `Vorschlag`.
9. **KI-Kennzeichnung:** Standardtext der Offenlegung in DMs fest verdrahtet, vom Kunden nicht abschaltbar (Art. 50 Abs. 1, seit 2.8.2026 anwendbar). Für öffentliche Kommentarantworten Offenlegung als Voreinstellung an (Auslegung offen).
10. **Datenschutz im Bau:** Kommentar-/DM-Texte Dritter laufen durch `fremd()` und KI-Tor mit Pseudonymisierung; keine Antwort ohne Protokolleintrag.

## Was zur Sperre führt

Belegt in offiziellen Quellen:
- **Automatisierung außerhalb der offiziellen API** (Skripte, Browser-Bots, Scraper): Instagram „unauthorized ways“, LinkedIn §8.2 Nr. 2 und 13, TikTok „automation tools, scripts“. Konto kann eingeschränkt oder geschlossen werden.
- **Spam:** hohe Frequenz, wiederholte/nahezu identische Texte, Werbung unter fremden Beiträgen (YouTube-Spam-Richtlinie wörtlich; Meta verweist in der Developer Policy auf seine Spam-Definition; deren Wortlaut ist hier nicht belegt).
- **Inauthentisches Verhalten:** LinkedIn §8.2 Nr. 13 „inauthentic engagement“, Nr. 16 „manipulating algorithms“; TikTok inauthentische Metriken.
- **Unaufgeforderte DMs, fehlendes Opt-out, Nachrichten außerhalb des 24-h-Fensters ohne zulässigen Tag, Werbung in Tags** (Meta Developer Policy §5.2, §5.6).
- **Übermäßig viel negatives Feedback** auf das Messaging-Erlebnis (Meta §5.4): Beschränkung oder Entfernung der Funktion.
- **Verwirrende/sinnlose Antworten, Täuschung** (Meta §5.1, §1.4); Bot, der sich als Mensch ausgibt.
- **API-Limits umgehen** (LinkedIn §3.1(20), mehrere Apps für denselben Zweck) und **automatisches Veröffentlichen über die LinkedIn-API** (§3.1(26)).
- **Handlungen im Namen von Nutzern ohne klare Auslösung/Einwilligung** (YouTube III.C.2, III.E.3.d, III.I.2).

Nicht belegt (offen):
- Genauer Wortlaut der Meta-Spam-Regeln (Frequenzgrenzen, „identische Kommentare“) – Seite beim Abruf leer; manuell prüfen unter https://transparency.meta.com/policies/community-standards/spam/.
- Ob die Instagram-Kommentar-Antwort nur Top-Level-Kommentare betrifft; Rate Limit der Antwort-Route.
- Ob `w_member_social` (Share on LinkedIn) Kommentare erlaubt; ob LinkedIn automatisiertes Kommentieren über die Community Management API ausdrücklich zulässt.
- Ob Metas Bot-Responsiveness-Regel (30 s) für Instagram gilt.
- Ob Art. 50 Abs. 1 auf öffentliche Kommentarantworten angewandt wird; Details zum „AI Omnibus“ nur über Kommissionsseite (Primär) und Kanzlei-Blogs (Sekundär).
- TikTok-Kommentar-API (offiziell keine gefunden).
