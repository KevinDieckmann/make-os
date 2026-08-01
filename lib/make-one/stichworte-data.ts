// ─── MAKE OS — Stichworte ───────────────────────────────────────────────────
// Die feine Klassierung unter den vier Themen: die Begriffe, an denen wir alles
// wiederfinden — Aufgaben, Kennzahlen, Notizen. Erkannt am Text; von Hand
// gesetzte gewinnen immer.
//
// Herkunft: aus 302 echten Dateien gezogen (KEMA_Brain, MAKE Brain, unsere
// Stores, KPI-Register) — keine erfundenen Standardbegriffe.
//
// Zweck ist das Abarbeiten am Stück: „Steuerberater" anklicken und alles
// sehen, was dazu offen ist — quer über Projekte und Themen hinweg.
//
// Client-safe: keine Server-Importe.

export interface Stichwort {
  id: string;
  label: string;
  /** Thema, unter dem es normalerweise läuft (recht|umsatz|produkt|leben). */
  thema: string;
  /** Erkennt das Stichwort im Text. Wortgrenzen setzen, wo Verwechslung droht. */
  muster: RegExp;
  /** Messbare Kennzahl — taucht als KPI auf. */
  kpi?: boolean;
}

export const STICHWORTE: Stichwort[] = [
  // ── RECHT & FUNDAMENT ─────────────────────────────────────────────────────
  { id: 'rechtsfaehigkeit', label: 'Rechtsfähigkeit', thema: 'recht', muster: /rechtsf[äa]hig|rechtssicher|rechtens/i },
  { id: 'gruendung', label: 'Gründung', thema: 'recht', muster: /gr[üu]ndung|gegr[üu]ndet|beurkund/i },
  { id: 'gewerbeanmeldung', label: 'Gewerbeanmeldung', thema: 'recht', muster: /gewerbe/i },
  { id: 'handelsregister', label: 'Handelsregister', thema: 'recht', muster: /handelsregister|\bhrb\b|hr-?eintrag/i },
  { id: 'notar', label: 'Notar', thema: 'recht', muster: /notar|eichenauer/i },
  { id: 'stammkapital', label: 'Stammkapital', thema: 'recht', muster: /stammkapital|einlage|500\s?€/i },
  { id: 'steuernummer', label: 'Steuernummer', thema: 'recht', muster: /steuernummer|steuer-?nr|elster|steuerliche erfassung/i },
  { id: 'umsatzsteuer', label: 'Umsatzsteuer', thema: 'recht', muster: /umsatzsteuer|\bust\b|mwst|vorsteuer|reverse charge|kleinunternehmer/i },
  { id: 'steuerberater', label: 'Steuerberater', thema: 'recht', muster: /steuerberat|j[öo]rn peters|steuerlich/i },
  { id: 'buchhaltung', label: 'Buchhaltung', thema: 'recht', muster: /buchhalt|\bbeleg|kontier|datev/i },
  { id: 'lohnbuchhaltung', label: 'Lohnbuchhaltung', thema: 'recht', muster: /lohnbuch|gehaltsabrechn|lohnabrechn/i },
  { id: 'jahresabschluss', label: 'Jahresabschluss', thema: 'recht', muster: /jahresabschluss|bilanz|\beuer\b|gewinnermittl/i },
  { id: 'vertrag', label: 'Vertrag', thema: 'recht', muster: /vertrag|vertragswerk|\bagb\b/i },
  { id: 'gesellschaftervertrag', label: 'Gesellschaftervertrag', thema: 'recht', muster: /gesellschaftervertrag|\bgv\b\s|satzung/i },
  { id: 'captable', label: 'Cap Table', thema: 'recht', muster: /cap.?table|gesellschafterstruktur|beteiligungsstruktur|anteilsverteilung/i },
  { id: 'nda', label: 'NDA', thema: 'recht', muster: /\bnda\b|geheimhaltung|testvereinbarung/i },
  { id: 'vollmacht', label: 'Vollmacht', thema: 'recht', muster: /vollmacht|prokura|unterschriftsrecht|freigabe.?recht/i },
  { id: 'haftung', label: 'Haftung', thema: 'recht', muster: /haftung|haftbar|exkulpation|insolvenz/i },
  { id: 'compliance', label: 'Compliance', thema: 'recht', muster: /compliance|revisionssicher|verfahrensdoku|audit/i },
  { id: 'anstellung', label: 'Anstellung', thema: 'recht', muster: /anstell|einstell|arbeitsvertrag|angestellt|\bbav\b/i },
  { id: 'versicherung', label: 'Versicherung', thema: 'recht', muster: /versicher|haftpflicht|rechtsschutz/i },
  { id: 'behoerde', label: 'Behörde', thema: 'recht', muster: /beh[öo]rde|agentur f[üu]r arbeit|finanzamt|betriebsnummer|gewerbeamt/i },
  { id: 'namensaenderung', label: 'Namensänderung', thema: 'recht', muster: /namens[äa]nder|umbenenn|kd management|namensf[üu]hrung/i },
  { id: 'geschaeftsadresse', label: 'Geschäftsadresse', thema: 'recht', muster: /gesch[äa]ftsadresse|firmenadresse|firmendomizil|office club|kurf[üu]rstendamm|postzustell/i },
  { id: 'rechtsstreit', label: 'Rechtsstreit', thema: 'recht', muster: /rechtsstreit|klage|gericht|sachverst[äa]ndig|mietpreisbremse/i },
  { id: 'anwalt', label: 'Anwalt', thema: 'recht', muster: /anwalt|kanzlei|juristisch/i },
  { id: 'datenschutz', label: 'Datenschutz', thema: 'recht', muster: /datenschutz|dsgvo|einwillig|consent/i },
  { id: 'frist', label: 'Frist', thema: 'recht', muster: /\bfrist|deadline|termingebunden/i },

  // ── UMSATZ & CASHFLOW ─────────────────────────────────────────────────────
  { id: 'umsatz', label: 'Umsatz', thema: 'umsatz', muster: /umsatz|erl[öo]s|einnahme/i, kpi: true },
  { id: 'gewinn', label: 'Gewinn', thema: 'umsatz', muster: /gewinn|marge|profitab|ebitda|ertrag/i, kpi: true },
  { id: 'cashflow', label: 'Cashflow', thema: 'umsatz', muster: /cashflow|zahlungsstrom|geldfluss/i, kpi: true },
  { id: 'liquiditaet', label: 'Liquidität', thema: 'umsatz', muster: /liquidit|kontostand|runway|burn.?rate/i, kpi: true },
  { id: 'rechnung', label: 'Rechnung', thema: 'umsatz', muster: /rechnung|invoice|abrechn|\bopos\b/i, kpi: true },
  { id: 'zahlung', label: 'Zahlung', thema: 'umsatz', muster: /zahlung|bezahl|[üu]berweis|zahlungseingang/i },
  { id: 'forderung', label: 'Forderung', thema: 'umsatz', muster: /forderung|offene[rn]? posten|au[ßs]enstand|mahnung/i, kpi: true },
  { id: 'schulden', label: 'Schulden', thema: 'umsatz', muster: /schulden|verbindlichkeit|restschuld|tilg/i, kpi: true },
  { id: 'kredit', label: 'Kredit', thema: 'umsatz', muster: /kredit|darlehen|\braten?\b|zins|b[üu]rgschaft/i },
  { id: 'budget', label: 'Budget', thema: 'umsatz', muster: /budget|variable kosten|haushaltsplan|ausgabenplan/i },
  { id: 'fixkosten', label: 'Fixkosten', thema: 'umsatz', muster: /fixkosten|laufende kosten|betriebskosten|\babo\b/i, kpi: true },
  { id: 'finanzplan', label: 'Finanzplan', thema: 'umsatz', muster: /finanzplan|controlling|plan vs|finanzmeeting|finanzplanung/i },
  { id: 'entnahme', label: 'Entnahme', thema: 'umsatz', muster: /entnahme|auszahlung|privatentnahme|gf-?gehalt/i, kpi: true },
  { id: 'bank', label: 'Bank', thema: 'umsatz', muster: /\bbank\b|vivid|\bn26\b|\bdkb\b|\bkonto\b|finapi/i },
  { id: 'sparen', label: 'Sparen', thema: 'umsatz', muster: /sparen|r[üu]cklage|notgroschen|sparplan|\betf\b|depot/i, kpi: true },
  { id: 'foerderung', label: 'Förderung', thema: 'umsatz', muster: /\bf[öo]rder|zuschuss|einstiegsgeld|bsfz/i, kpi: true },
  { id: 'investor', label: 'Investor', thema: 'umsatz', muster: /investor|kapitalgeber|business angel|\bvc\b/i },
  { id: 'investment', label: 'Investment', thema: 'umsatz', muster: /investment|funding|\bseed\b|use of funds/i, kpi: true },
  { id: 'bewertung', label: 'Bewertung', thema: 'umsatz', muster: /unternehmenswert|bewertung|valuation/i, kpi: true },
  { id: 'beteiligung', label: 'Beteiligung', thema: 'umsatz', muster: /beteiligung|anteil|equity|gesellschafter/i },
  { id: 'pitch', label: 'Pitch', thema: 'umsatz', muster: /pitch|investorenansprache|\bdeck\b/i },
  { id: 'kunde', label: 'Kunde', thema: 'umsatz', muster: /\bkunde|kundschaft|auftraggeber|testkunde/i, kpi: true },
  { id: 'lead', label: 'Lead', thema: 'umsatz', muster: /\bleads?\b|interessent|\banfrage|longlist|\bmql\b|\bsql\b/i, kpi: true },
  { id: 'pipeline', label: 'Pipeline', thema: 'umsatz', muster: /pipeline|\bdeal|opportunit/i, kpi: true },
  { id: 'crm', label: 'CRM', thema: 'umsatz', muster: /\bcrm\b|kontaktdaten|hubspot/i },
  { id: 'akquise', label: 'Akquise', thema: 'umsatz', muster: /akquise|outreach|kaltakquise|ansprache/i },
  { id: 'vertrieb', label: 'Vertrieb', thema: 'umsatz', muster: /vertrieb|\bsales\b|abschluss|closing/i },
  { id: 'konversionsrate', label: 'Konversionsrate', thema: 'umsatz', muster: /konversion|conversion|visitor-to/i, kpi: true },
  { id: 'abschlussquote', label: 'Abschlussquote', thema: 'umsatz', muster: /abschlussquote|win.?rate|closing.?rate/i, kpi: true },
  { id: 'salescycle', label: 'Sales Cycle', thema: 'umsatz', muster: /sales.?cycle|verkaufszyklus|response.?time|sales velocity/i, kpi: true },
  { id: 'dealgroesse', label: 'Deal-Größe', thema: 'umsatz', muster: /deal.?size|deal.?gr[öo][ßs]e|\bacv\b|\baov\b/i, kpi: true },
  { id: 'cac', label: 'Akquisekosten', thema: 'umsatz', muster: /\bcac\b|akquisekosten|\bcpl\b|\bcpql\b/i, kpi: true },
  { id: 'ltv', label: 'Kundenwert', thema: 'umsatz', muster: /\bltv\b|lifetime value|kundenwert/i, kpi: true },
  { id: 'arr', label: 'Wiederkehrender Umsatz', thema: 'umsatz', muster: /\barr\b|\bmrr\b|recurring|wiederkehrend/i, kpi: true },
  { id: 'churn', label: 'Abwanderung', thema: 'umsatz', muster: /churn|abwanderung|k[üu]ndigungsquote/i, kpi: true },
  { id: 'retention', label: 'Bindung', thema: 'umsatz', muster: /retention|\bnrr\b|\bgrr\b|kundenbindung/i, kpi: true },
  { id: 'nps', label: 'Zufriedenheit', thema: 'umsatz', muster: /\bnps\b|net promoter|\bcsat\b|zufriedenheit/i, kpi: true },
  { id: 'mandat', label: 'Mandat', thema: 'umsatz', muster: /mandat|\bauftrag\b|klarheits-?sprint/i },
  { id: 'angebot', label: 'Angebot', thema: 'umsatz', muster: /angebot|offerte|proposal/i },
  { id: 'preis', label: 'Preis', thema: 'umsatz', muster: /\bpreis|pricing|honorar|tagessatz|stundensatz|\btier\b/i },
  { id: 'produktpaket', label: 'Produktpaket', thema: 'umsatz', muster: /produktpaket|leistungspaket|paketpreis/i },
  { id: 'provision', label: 'Provision', thema: 'umsatz', muster: /provision|erfolgsfee|kommission|handelsvertreter|reseller/i, kpi: true },
  { id: 'partner', label: 'Partner', thema: 'umsatz', muster: /partner|kooperation|solution.?partner/i },
  { id: 'multiplikator', label: 'Multiplikator', thema: 'umsatz', muster: /multiplikator|tippgeber|empfehlung|referral|f[üu]rsprecher/i },
  { id: 'netzwerk', label: 'Netzwerk', thema: 'umsatz', muster: /netzwerk|stammtisch|bvmw|kontaktpflege/i },
  { id: 'event', label: 'Event', thema: 'umsatz', muster: /\bevents?\b|veranstaltung|pitch.?day/i, kpi: true },
  { id: 'presse', label: 'Pressearbeit', thema: 'umsatz', muster: /presse|journalist|reichweite|\bpr\b/i, kpi: true },
  { id: 'linkedin', label: 'LinkedIn', thema: 'umsatz', muster: /linkedin|personal branding|posting/i, kpi: true },
  { id: 'webinar', label: 'Webinar', thema: 'umsatz', muster: /webinar|newsletter|e-?mail-?sequenz|kampagne/i },

  // ── PRODUKT & SYSTEM ──────────────────────────────────────────────────────
  { id: 'makeos', label: 'MAKE OS', thema: 'produkt', muster: /make ?os|make\.one|unser system|eigene software/i },
  { id: 'jarvis', label: 'Jarvis', thema: 'produkt', muster: /jarvis|zentrale intelligenz|assistent/i },
  { id: 'kemaris', label: 'KEMARIS', thema: 'produkt', muster: /kemaris|innovation group|\bkig\b/i },
  { id: 'capos', label: 'CapOS', thema: 'produkt', muster: /capos|cap.?os\b|capital operations|capital readiness/i },
  { id: 'connect', label: 'KEMARIS Connect', thema: 'produkt', muster: /\bconnect\b|inner circle|community/i },
  { id: 'kimmi', label: 'Kimmi', thema: 'produkt', muster: /kimmi|ki-?cfo|kemaris ai/i },
  { id: 'ksi', label: 'Souveränitäts-Index', thema: 'produkt', muster: /\bksi\b|souver[äa]nit[äa]ts/i, kpi: true },
  { id: 'markttraktion', label: 'Markttraktion', thema: 'produkt', muster: /markttraktion|market.?traction|traktion/i, kpi: true },
  { id: 'grantpilot', label: 'Grant Pilot', thema: 'produkt', muster: /grant.?pilot|cashradar|taxtool|f[öo]rdermittel-?check/i },
  { id: 'riskshield', label: 'Risk-Shields', thema: 'produkt', muster: /risk.?shield|risiko-?monitoring|\balert|warnung/i },
  { id: 'agent', label: 'Agent', thema: 'produkt', muster: /\bagenten?\b|ki-?agent|agenten-?lauf/i },
  { id: 'automatisierung', label: 'Automatisierung', thema: 'produkt', muster: /automatis|workflow|\bloop\b|trigger|no-?code/i },
  { id: 'ki', label: 'KI', thema: 'produkt', muster: /\bki\b|\bai\b|k[üu]nstliche intelligenz|claude|sprachmodell/i },
  { id: 'kpi', label: 'Kennzahlen', thema: 'produkt', muster: /\bkpi|kennzahl|metrik|messbar|kpi-?register/i, kpi: true },
  { id: 'makescore', label: 'MAKE Score', thema: 'produkt', muster: /make score|performance.?index|\bscore\b|scoring/i, kpi: true },
  { id: 'meilenstein', label: 'Meilenstein', thema: 'produkt', muster: /meilenstein|etappe|messlatte/i, kpi: true },
  { id: 'datenbasis', label: 'Datenbasis', thema: 'produkt', muster: /datenbasis|single source|datenqualit|reconciliation/i },
  { id: 'datenbank', label: 'Datenbank', thema: 'produkt', muster: /datenbank|postgres|database|datensatz/i },
  { id: 'stammdaten', label: 'Stammdaten', thema: 'produkt', muster: /stammdaten|grunddaten|ansprechpartner/i },
  { id: 'anbindung', label: 'Anbindung', thema: 'produkt', muster: /anbindung|integration|schnittstelle|\bapi\b|oauth|\bsync|connector/i },
  { id: 'cloud', label: 'Cloud & Hosting', thema: 'produkt', muster: /cloud|hetzner|\bserver\b|online stellen|deploy|hosting|netlify/i },
  { id: 'github', label: 'GitHub', thema: 'produkt', muster: /github|\brepo\b|commit|versionier/i },
  { id: 'sicherheit', label: 'Sicherheit', thema: 'produkt', muster: /sicherheit|zugriffsschutz|schl[üu]ssel|passwort|verschl[üu]ssel/i },
  { id: 'inbox', label: 'Postfach', thema: 'produkt', muster: /inbox|posteingang|triage|postfach|outlook|microsoft 365/i, kpi: true },
  { id: 'kalender', label: 'Kalender', thema: 'produkt', muster: /kalender|\btermin|wochenplan|tagesplan|jour fixe/i },
  { id: 'dashboard', label: 'Dashboard', thema: 'produkt', muster: /dashboard|cockpit|kachel|mission control|startseite/i },
  { id: 'bauplan', label: 'Bauplan', thema: 'produkt', muster: /bauplan|backlog|roadmap|ausbaustufe/i },
  { id: 'prototyp', label: 'Prototyp', thema: 'produkt', muster: /prototyp|mockup|\bmvp\b|klickdummy|entwurf/i },
  { id: 'website', label: 'Website', thema: 'produkt', muster: /website|homepage|landingpage|webseite|early.?access/i },
  { id: 'brandci', label: 'Brand CI', thema: 'produkt', muster: /brand.?ci|corporate identity|\blogo\b|typografie|farbmodell/i },
  { id: 'terminologie', label: 'Terminologie', thema: 'produkt', muster: /terminologie|sprachregel|vokabular|wording/i },
  { id: 'content', label: 'Content', thema: 'produkt', muster: /content|beitrag|artikel/i },
  { id: 'transkript', label: 'Transkript', thema: 'produkt', muster: /transkript|mitschrift|fireflies|protokoll/i },
  { id: 'fuf', label: 'F&F-Launch', thema: 'produkt', muster: /f&f|friends.?family|launch|markteintritt/i },
  { id: 'uebergabe', label: 'Übergabe', thema: 'produkt', muster: /[üu]bergabe|handover|onboarding|dokumentation/i },
  { id: 'team', label: 'Team', thema: 'produkt', muster: /\bteam|mitarbeit|\brolle|zust[äa]ndig|delegier|quapler|\bcto\b/i },

  // ── GESUNDHEIT & LEBEN ────────────────────────────────────────────────────
  { id: 'rehabilitation', label: 'Rehabilitation', thema: 'leben', muster: /\breha|physio|\br[üu]cken|genesung|mobilit[äa]t/i },
  { id: 'behandlung', label: 'Behandlung', thema: 'leben', muster: /behandlung|infiltration|spritze|orthop[äa]de|\barzt|[äa]rztlich|praxis/i },
  { id: 'sport', label: 'Sport', thema: 'leben', muster: /sport|training|\bkraft|bouldern|padel|fu[ßs]ball|fitness/i, kpi: true },
  { id: 'laufen', label: 'Laufen', thema: 'leben', muster: /\blaufen|\blauf\b|running|longrun|marathon|hyrox/i, kpi: true },
  { id: 'ernaehrung', label: 'Ernährung', thema: 'leben', muster: /ern[äa]hrung|\bessen\b|kalorien|meal.?prep|mahlzeit|kochen/i },
  { id: 'einkauf', label: 'Einkauf', thema: 'leben', muster: /einkauf|einkaufsliste|vorrat/i },
  { id: 'supplements', label: 'Supplements', thema: 'leben', muster: /supplement|omega-?3|vitamin/i },
  { id: 'schlaf', label: 'Schlaf', thema: 'leben', muster: /schlaf|\bbett\b/i, kpi: true },
  { id: 'erholung', label: 'Erholung', thema: 'leben', muster: /recovery|\bhrv\b|ruhepuls|erholung|regeneration|strain/i, kpi: true },
  { id: 'whoop', label: 'Whoop', thema: 'leben', muster: /whoop|wearable|tracker|tagesform/i },
  { id: 'verzicht', label: 'Verzicht', thema: 'leben', muster: /verzicht|\bcut\b|alkohol|30 tage ohne/i, kpi: true },
  { id: 'meditation', label: 'Meditation', thema: 'leben', muster: /meditation|mindfulness|achtsamkeit|atem[üu]bung|retreat/i },
  { id: 'routine', label: 'Routine', thema: 'leben', muster: /routine|ritual|gewohnheit|tagesstart|tagesende|shutdown/i, kpi: true },
  { id: 'journal', label: 'Journal', thema: 'leben', muster: /journal|tagebuch|reflexion|r[üu]ckblick|review/i },
  { id: 'fokus', label: 'Fokuszeit', thema: 'leben', muster: /fokus|konzentration|ablenkung|deep work|arbeitsmodus/i, kpi: true },
  { id: 'beziehung', label: 'Beziehung', thema: 'leben', muster: /beziehung|partnerschaft|\bpaar\b|date night|emotional bank/i, kpi: true },
  { id: 'abstimmung', label: 'MAKE Abstimmung', thema: 'leben', muster: /make.?abstimmung|make.?reflexion|check-?in|sunday dinner/i, kpi: true },
  { id: 'familie', label: 'Familie', thema: 'leben', muster: /familie|eltern|\bmama\b|\bpapa\b|kinder/i },
  { id: 'freunde', label: 'Freunde', thema: 'leben', muster: /freunde|freundeskreis|treffen mit/i },
  { id: 'luna', label: 'Luna', thema: 'leben', muster: /\bluna\b|\bhund\b|tierarzt|gassi/i },
  { id: 'wohnung', label: 'Wohnung', thema: 'leben', muster: /wohnung|\bmiete\b|vermieter|umzug|zuhause/i },
  { id: 'haushalt', label: 'Haushalt', thema: 'leben', muster: /haushalt|putzen|reinig|reparatur|handwerker|waschmaschine|ikea/i },
  { id: 'urlaub', label: 'Urlaub', thema: 'leben', muster: /urlaub|\breise|auszeit|bucket list/i },
  { id: 'lebensziel', label: 'Lebensziel', thema: 'leben', muster: /lebensziel|vision|freiheit|langfristig|ziele-?session/i, kpi: true },
  { id: 'lernen', label: 'Lernen', thema: 'leben', muster: /lernen|\bbuch\b|\bkurs\b|weiterbild|\bcoach/i },
  { id: 'ausruestung', label: 'Ausrüstung', thema: 'leben', muster: /laptop|macbook|\bger[äa]t|hardware|kopfh[öo]rer/i },
];

export const STICHWORT = Object.fromEntries(STICHWORTE.map(s => [s.id, s])) as Record<string, Stichwort>;

/** Selbst angelegtes Stichwort (aus /api/state/filter) — Wörter statt Regex. */
export interface EigenesStichwort { id: string; label: string; thema: string; woerter: string[]; kpi?: boolean }

/** Eigene Stichworte in die Liste einreihen — sie verhalten sich wie eingebaute. */
export function mitEigenen(eigene: EigenesStichwort[] = []): Stichwort[] {
  const zusatz = eigene
    .filter(e => e.label && e.woerter?.length)
    .map(e => ({
      id: e.id,
      label: e.label,
      thema: e.thema,
      kpi: e.kpi,
      // Wörter werden zu einem ODER-Muster; Sonderzeichen entschärft.
      muster: new RegExp(e.woerter.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i'),
    }));
  return [...STICHWORTE, ...zusatz];
}

/** Alle Stichworte einer Aufgabe: von Hand gesetzte + im Text erkannte. */
export function stichworteVon(
  t: { id: string; title: string; description?: string },
  handisch: Record<string, string[]> = {},
  liste: Stichwort[] = STICHWORTE,
): string[] {
  const gesetzt = handisch[t.id] ?? [];
  const text = `${t.title} ${t.description ?? ''}`;
  const erkannt = liste.filter(s => s.muster.test(text)).map(s => s.id);
  return Array.from(new Set([...gesetzt, ...erkannt]));
}

/** Kennzahlen-Stichworte — für Auswertungen und den Kennzahlen-Filter. */
export const KPI_STICHWORTE = STICHWORTE.filter(s => s.kpi);
