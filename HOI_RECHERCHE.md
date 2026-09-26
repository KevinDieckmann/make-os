# HOI — Head of IT · Best-Practice-Recherche

**Stand:** 26.09.2026 · **Quellen:** 66 (nummeriert, feldweise; Primärquellen bevorzugt, 2024–2026) · **Für:** Kevin Dieckmann, MAKE OS
**Ausgangslage (aus dem Repo gelesen):** Next.js 15 in Docker (`app` 1536 MB · `arbeiter` 512 MB · `caddy` 256 MB, `cap_drop: ALL`, `no-new-privileges`), Hetzner 1 vCPU/2 GB, Caddy/Let's Encrypt, SSH nur `make`+sudo mit fail2ban/ufw, GitHub Action `pruefen-und-ausrollen.yml` (tsc · vitest · lint → Bild bauen → per `restrict`-SSH-Schlüssel ausliefern), nächtliche Sicherung `deploy/sicherung.sh` (age, 14 Tage, **auf demselben Server**), Heads mit Risiko-Stufen (`lib/heads/autonomie.ts`: intern-rücknehmbar = automatisch, alles nach außen = Freigabe), Telegram-Bote (`bote.mjs`), Freigabe-Stapel + Protokoll.

---

## 1 · Überwachung von außen (Uptime / Synthetic) für einen Server

**Erkenntnisse**
- Ein Wächter auf demselben Server ist blind, wenn der Server steht. Uptime Kuma (Node, ~30–80 MB RAM, 31 Monitortypen, Statusseiten, 90+ Alarmwege) und Gatus (Go-Binary, ~10–40 MB, YAML im Git, Bedingungen wie `[STATUS]`, `[RESPONSE_TIME]`, `[CERTIFICATE_EXPIRATION]`) sind erstklassig — aber nur mit zweitem Standort sinnvoll. [1][2][3][4]
- Für 0 € **ohne zweiten Server** ist die beste Kombination: (a) ein SaaS-Freikontingent für HTTP/TLS-Prüfung, (b) Healthchecks.io als Dead-Man-Switch für Cron/Sicherung, (c) GitHub-Actions-Cron für tiefere, seltenere Prüfungen. [5][6][7][10]
- SaaS-Freikontingente 2026: Better Stack 10 Monitore, 3-Minuten-Takt, 1 Statusseite, alle Funktionen; UptimeRobot 50 Monitore, 5-Minuten-Takt, 1 Statusseite, 3 Monate Historie. [10]
- Healthchecks.io: Job pingt nach Erfolg eine URL; bleibt der Ping aus (Grace-Zeit), Alarm. Empfohlene Aufrufform: `curl -fsS -m 10 --retry 5 -o /dev/null <URL>`; `/start` und `/fail` melden Laufzeit und Fehler, Exit-Code anhängbar. Frei: 20 Checks, 100 Logeinträge je Check. [5][6]
- GitHub-Actions-`schedule`: kürzestes Intervall 5 Minuten; „kann bei hoher Last verzögert werden" (5–30 Minuten Verzug sind Alltag, >60 Minuten dokumentiert); läuft nur vom Default-Branch; in **öffentlichen** Repos nach 60 Tagen Inaktivität automatisch abgeschaltet. Für Sofort-Alarme ungeeignet, für 6-Stunden-/Wochenprüfungen ideal. [7][8][9]
- Zertifikatslaufzeit gehört in jede Außenprüfung; Lehre aus Blackbox-Exporter: die Ablauf-Metrik verschwindet, wenn der Handshake schon scheitert — immer zusätzlich auf `probe_success`/HTTP-Status alarmieren. Schwelle 7–14 Tage. [11]
- Alarmweg: Telegram-Bot ist kostenlos, mobil, in Sekunden da (`sendMessage` mit `chat_id`, `text`; Token von BotFather) — MAKE OS hat den Bot schon. Zweiter Weg (E-Mail) als Rückfallebene, weil ein einzelner Kanal selbst ausfallen kann. [12][13][5]

**Quellen**
1. Uptime Kuma — louislam/uptime-kuma (GitHub), 2026, https://github.com/louislam/uptime-kuma
2. Gatus — TwiN/gatus (GitHub), 2026, https://github.com/TwiN/gatus
3. Gatus vs Uptime Kuma (2026): YAML Config vs a Web UI — Instapods, 2026, https://instapods.com/apps/uptime-kuma/vs/gatus/
4. Top 8 Self-Hosted Uptime Kuma Alternatives — Better Stack Community, 2026, https://betterstack.com/community/comparisons/uptime-kuma-alternative/
5. How to Monitor Cron Jobs with Healthchecks.io — Healthchecks.io Docs, 2025, https://healthchecks.io/docs/monitoring_cron_jobs/
6. Pricing (Free: 20 checks) — Healthchecks.io, 2026, https://healthchecks.io/pricing/
7. Events that trigger workflows: `schedule` — GitHub Docs, 2026, https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule
8. GitHub Actions Cron Not Running On Time? — Runhooks, 2025, https://runhooks.app/blog/github-actions-scheduled-workflows-unreliable/
9. HTTP(s) URL health check and TLS/SSL certification expiry check — GitHub Marketplace, 2025, https://github.com/marketplace/actions/http-s-url-health-check-and-tls-ssl-certification-expiry-check
10. Better Stack vs UptimeRobot: A Complete Comparison for 2026 — Better Stack, 2026, https://betterstack.com/community/comparisons/better-stack-vs-uptimerobot/
11. Monitoring TLS Endpoint Certificate Expiration with Prometheus — PromLabs, 2024, https://promlabs.com/blog/2024/02/06/monitoring-tls-endpoint-certificate-expiration-with-prometheus/
12. Telegram Bot API (sendMessage, getUpdates/Webhook) — Telegram, 2026, https://core.telegram.org/bots/api
13. Telegram notifications from Uptime Kuma — uptimekuma.io, 2025, https://uptimekuma.io/telegram-notifications-uptime-kuma/

---

## 2 · Sicherheits-Selbstprüfung, automatisiert

**Erkenntnisse**
- **Header-Check:** MDN HTTP Observatory API v2 — `POST https://observatory-api.mdn.mozilla.net/api/v2/scan?host=<domain>`, kein Schlüssel, 1 Scan/Minute/Host (sonst Cache), JSON mit `grade`, `score`, `tests_failed`; als CLI `npm i -g @mdn/mdn-http-observatory`. Ideal als wöchentliche KPI „Sicherheits-Note". [14]
- **TLS:** SSL Labs API (v4 mit registrierter E-Mail, Nutzungsregeln/Kontingente beachten; Referenz-Client `ssllabs-scan`) für die offizielle Note; testssl.sh (Bash, Docker-Bild, Ausgabe für Automatisierung) für eigene, häufigere Läufe ohne Fremddienst. [15][16]
- **Abhängigkeiten & Bild:** `npm audit` (schnell, npm-Datenbank), OSV-Scanner (offene OSV-Datenbank, Lockfiles + Container-Bilder, eigene Action) und Trivy (OS-Pakete + Bibliotheken im Docker-Bild, SARIF in den GitHub-Security-Tab, `ignore-unfixed: true` gegen Rauschen). Empfehlung: bei jedem Push **und** täglich per Cron, weil neue CVEs ohne Codeänderung auftauchen. [17][18][19]
- **Aktualisierungs-Bots:** Dependabot (im Repo, Auto-Merge nur mit Zusatz-Workflow) oder Renovate (Automerge/Gruppierung eingebaut, bessere Lockfile-Semantik) — siehe Feld 4. [51][52][53]
- **Host:** Lynis wöchentlich `lynis audit system --cronjob` → Hardening-Index (Ziel ≥ 80; CIS-konforme Systeme 85–90); Abfall unter Schwelle = gelb. CIS Ubuntu 24.04 Benchmark v2.0.0 (06/2026) als Referenz, Level 1 genügt. [20][21]
- **Anmeldungen:** `fail2ban-client status sshd` (aktuell/gesamt gebannt), `journalctl -u ssh` für fehlgeschlagene Logins; auf Debian/Ubuntu mit `backend = systemd`. Der HOI bekommt **Zähler und gekürzte IPs**, keine Rohzeilen (Feld 6). [27]
- **Geheimnisse:** gitleaks als Pre-Commit **und** in CI (`gitleaks/gitleaks-action@v2`; Pre-Commit lässt sich mit `--no-verify` umgehen, CI ist das Netz). Für Organisations-Repos kostenloser Lizenzschlüssel nötig, für persönliche nicht. [22]
- **CSP-Meldungen:** `Reporting-Endpoints: csp="https://…/api/…"` + `Content-Security-Policy: …; report-to csp` (ersetzt `Report-To`); Next.js braucht für Nonces Middleware und dynamisches Rendern. Der Endpunkt zählt Verstöße je Direktive/Quelle — ohne Query-Strings. [23][24]
- **GitHub Actions selbst absichern:** Actions auf vollen Commit-SHA pinnen (einzige unveränderliche Referenz; seit 08/2025 per Policy erzwingbar), `permissions` minimal (das Repo tut das bereits: `contents: read`), Secrets werden in Logs geschwärzt; Lehren aus den Supply-Chain-Vorfällen 2025 (tj-actions). [28][29][30]
- **Sicherung:** age ist der richtige Weg (kleine explizite Schlüssel, `-R` Empfängerdatei, ab 1.3.2 Post-Quantum-Hybrid). Aber: 3-2-1(-1-0) verlangt eine **zweite Kopie außer Haus** und **regelmäßige Restore-Proben mit Prüfung „0 Fehler"** — beides fehlt heute (Sicherungen liegen unter `/srv/make-os/sicherungen` auf dem Server; der Server kann bewusst nicht entschlüsseln). [25][26]

**Quellen**
14. MDN HTTP Observatory — Backend, API v2, CLI — Mozilla/MDN (GitHub), 2025, https://github.com/mdn/mdn-http-observatory
15. ssllabs-scan — Referenz-Client für SSL Labs APIs (v3/v4) — Qualys (GitHub), 2025, https://github.com/ssllabs/ssllabs-scan
16. testssl.sh — Dirk Wetter, 2025, https://testssl.sh/
17. trivy-action — Aqua Security (GitHub), 2026, https://github.com/aquasecurity/trivy-action
18. OSV-Scanner — Google, 2025, https://google.github.io/osv-scanner/
19. How to Run Security Scanning with GitHub Actions — OneUptime, 2026, https://oneuptime.com/blog/post/2026-01-25-security-scanning-github-actions/view
20. Lynis — Security auditing tool — CISOfy, 2025, https://cisofy.com/lynis/
21. How to Verify Security Hardening with Lynis on Ubuntu — OneUptime, 2026, https://oneuptime.com/blog/post/2026-03-02-verify-security-hardening-lynis-ubuntu/view
22. gitleaks-action — Gitleaks (GitHub), 2025, https://github.com/gitleaks/gitleaks-action
23. Reporting-Endpoints header — MDN Web Docs, 2025, https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Reporting-Endpoints
24. Guides: Content Security Policy — Next.js Docs, 2025, https://nextjs.org/docs/app/guides/content-security-policy
25. age — simple, modern file encryption — FiloSottile (GitHub), 2026, https://github.com/FiloSottile/age
26. The Complete 2026 Guide to the 3-2-1 Backup Rule (3-2-1-1-0) — AvePoint, 2026, https://www.avepoint.com/blog/backup/3-2-1-backup-rule
27. Fail2ban — ArchWiki, 2025, https://wiki.archlinux.org/title/Fail2ban
28. Secure use reference (GitHub Actions) — GitHub Docs, 2026, https://docs.github.com/en/actions/reference/security/secure-use
29. GitHub Actions policy now supports blocking and SHA pinning actions — GitHub Changelog, 15.08.2025, https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/
30. Hardening GitHub Actions: Lessons from Recent Attacks — Wiz, 2025, https://www.wiz.io/blog/github-actions-security-guide

---

## 3 · „KI-SRE" — wie es die Besten machen

**Erkenntnisse**
- **Gemeinsames Muster aller Anbieter:** beobachten → Hypothesen bilden → Belege sammeln → Vorschlag mit Begründung → Mensch gibt frei → ausführen → protokollieren. Datadog Bits AI SRE (12/2025) untersucht Alarme, prüft eigene Befunde und liefert die Schlussfolgerung; PagerDuty SRE Agent triagiert autonom, Behebung per „Knopf nach Bauchcheck"; bekannte Muster autonom, Neues zum Menschen. Parity (YC S24) führt vordefinierte Runbooks auf K8s-Alarme aus. Cleric/Resolve/Traversal: Untersuchung read-only, Konfidenz-Werte, Autonomie schrittweise „verdient". [38][39][40][41][42][43]
- **Google SRE (2026):** Autonomie-Stufen L0–L4; Aufstieg nur nach nachgewiesener Trefferquote gegen menschlich geprüfte „Golden"-Daten; **Denken und Handeln entkoppelt** (Untersuchungs-Agent ≠ Aktuator mit deterministischen Leitplanken); eigene Agenten-Identität, Pflicht-Trockenlauf vor Änderungen, „agentische Sicherungen" (Rate-Limits), „Rote Taste" zum Sofort-Entzug der Rechte, nächtliche Evals gegen echte Vorfälle. [35]
- **ClickHouse-Praxis (2025):** „Die KI jagt, der Mensch entscheidet." Kein Frontier-Modell fand eingeschleuste Ursachen zuverlässig ohne Führung; Telemetrie nur über Read-only-Schnittstellen, Behebungsrechte hinter separatem Freigabepfad. [37]
- **Cleric-Report:** „Der Untersuchungs-Agent ist ein Wochenendprojekt — das System, das ihn verlässlich macht, nicht": Messung, Rückkopplung, verifizierte Ergebnisse. [38]
- **Was allein, was mit Freigabe (Konsens):** Allein: lesen, korrelieren, Berichte, Vorschläge, Aufgaben anlegen. Mit Freigabe: alles, was Produktion verändert. Rootly nennt „Neustart, Cache leeren, Feature-Flag" als typische erste autonome Aktionen — aber erst, wenn Vertrauen gemessen wurde. Für MAKE OS (1 vCPU, Agent läuft **in** der App) heißt das: Container-Neustart durch das Modell **nein**; deterministisches Autoheal per Healthcheck **ja** (Feld 5). [39][41][35]
- **Prompt-Injection über Logs ist real:** LogJack (04/2026) — 8 Modelle, 42 Angriffe in Cloud-Logs; Befehlsausführung 0 % (Claude Sonnet 4.6) bis 86,2 % (Llama 3.3 70B); Cloud-Guardrails erkannten fast nichts (Azure 1/32); „bereinigen und trotzdem ausführen"-Verhalten; RCE per `curl` bei 6/8 Modellen. OWASP LLM01:2025: externe Inhalte klar abgrenzen, Ausgabeformat erzwingen und per Code prüfen, Least Privilege, Human-in-the-Loop für privilegierte Aktionen. Konsequenz für den HOI: **nur strukturierte, gekürzte Metadaten als Eingabe, festes JSON-Schema als Ausgabe (wie `pruefer.ts`), keine Werkzeuge mit Seiteneffekt.** [33][34]
- **OWASP Top 10 für agentische Anwendungen (15.12.2025):** ASI01 Ziel-Entführung · ASI02 Werkzeugmissbrauch · ASI03 Identitäts-/Rechtemissbrauch · ASI04 Lieferkette · ASI05 unerwartete Codeausführung · ASI06 Gedächtnis-Vergiftung · ASI07 unsichere Agent-zu-Agent-Kommunikation · ASI08 Kaskadenfehler · ASI09 Vertrauensausnutzung · ASI10 abtrünnige Agenten. Kontrollen: „Least Agency", eigene Agenten-Identität, kurzlebige Schlüssel, Freigabe für wirkmächtige Aktionen, fälschungssichere Protokolle, Not-Aus. [44]
- **Anthropic:** einfach anfangen, Workflows vor Agenten, Prüfpunkte für Menschen, Werkzeuge so sorgfältig gestalten wie Oberflächen; Nutzer geben mit Erfahrung mehr frei (Auto-Freigabe 20 % → >40 % der Sitzungen), unterbrechen aber **mehr** (5 % → 9 %) — Sichtbarkeit und Eingriffsmöglichkeit schlagen starre Freigabezwänge. Nur 0,8 % aller Aktionen waren irreversibel. [31][32]
- **Runbooks/Postmortems:** Auslöser vorab festlegen (sichtbarer Ausfall, Datenverlust, Bereitschaftseingriff, Überwachungsversagen); Inhalt: Zeitverlauf, Wirkung, Ursache, Maßnahmen mit Verantwortlichem und Termin; blamefrei — „Die Kosten des Scheiterns sind Bildung." Der HOI kann Entwürfe schreiben; Kevin schließt ab. [36]

**Quellen**
31. Building Effective AI Agents — Anthropic, 12/2024, https://www.anthropic.com/engineering/building-effective-agents
32. Measuring AI agent autonomy in practice — Anthropic, 02/2026, https://www.anthropic.com/news/measuring-agent-autonomy
33. LLM01:2025 Prompt Injection — OWASP GenAI Security Project, 2025, https://genai.owasp.org/llmrisk/llm01-prompt-injection/
34. LogJack: Indirect Prompt Injection Through Cloud Logs Against LLM Debugging Agents — H. Shah, arXiv 2604.15368, 04/2026, https://arxiv.org/abs/2604.15368
35. AI Engineering for Reliable Operations — Google SRE, 2026, https://sre.google/resources/practices-and-processes/ai-engineering-reliable-operations/
36. Postmortem Culture: Learning from Failure — Google SRE Book, https://sre.google/sre-book/postmortem-culture/
37. AI SRE agents: can AI run your on-call? — ClickHouse Engineering, 2025, https://clickhouse.com/resources/engineering/ai-sre-agents
38. The State of AI SRE — Cleric, 2025, https://cleric.ai/resources/reports/the-state-of-ai-sre
39. What is an AI SRE? The Complete Guide — Rootly, 2026, https://rootly.com/ai-sre-guide
40. Datadog Launches Bits AI SRE Agent — Datadog (Pressemitteilung), 12/2025, https://www.datadoghq.com/about/latest-news/press-releases/datadog-launches-bits-ai-sre-agent-to-resolve-incidents-faster/
41. New enhancements to PagerDuty's SRE Agent — PagerDuty, 05/2026, https://www.pagerduty.com/blog/ai/new-enhancements-to-pagerdutys-sre-agent-triage-faster-without-waking-a-human/
42. Parity — AI SRE for Kubernetes — Parity (YC S24), 2025, https://www.tryparity.com/
43. Cleric vs Resolve.ai vs Traversal (2026) — WeTheFlywheel, 2026, https://wetheflywheel.com/en/comparisons/cleric-vs-resolve-ai-vs-traversal/
44. OWASP Top 10 for Agentic Applications 2026 — OWASP GenAI, 15.12.2025, https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ (Zusammenfassung: Teleport, https://goteleport.com/blog/owasp-top-10-agentic-applications/)

---

## 4 · Code-Verbesserung durch Agenten

**Erkenntnisse**
- **Review-Bots 2026:** CodeRabbit führt Benchmarks (52,5 % gefundene Fehler vs. 36,7 % Copilot), vier Git-Plattformen, 40+ Linter; Copilot Code Review nur in Pro/Pro+/Business (nicht Free), Kosten je Review 0,05–5 USD, automatisch per Ruleset; Claude Code Review (Anthropic-App) noch Team/Enterprise-Vorschau. Für MAKE OS am nächsten: die **Claude Code Action** — läuft mit `ANTHROPIC_API_KEY` (Kevin hat ihn), reagiert auf `@claude`, prüft PRs automatisch, läuft auch per `schedule` für Wartungsrundgänge; Werkzeuge per `claude_args` einschränkbar. [45][46][47][48]
- **Grundsatz:** Der Agent schlägt vor, ändert nicht direkt. Das passt zu Kevins Regel „nie auf `main` ohne ausdrückliches Wort" — der Bot kommentiert PRs nach `entwicklung` und schreibt Bauplan-Einträge; `main` bleibt Kevins Hand. [31][32]
- **CI-Pflicht** ist schon da (tsc strict, vitest, lint). Ergänzen: Sicherheits-Scans (Feld 2) und Tech-Debt-Messung als **Bericht, nicht als Blocker** (erst Schwellen lernen, dann blocken). [19][49]
- **Tech-Debt-Erkennung:** Knip findet ungenutzte Dateien, Exporte, Abhängigkeiten, doppelte/unaufgelöste Importe in einem Lauf (150+ Plugins, Next.js/Vitest inklusive); depcheck und ts-prune wurden 2025 archiviert. madge nur für Zyklus-Grafiken ergänzend. [49][50]
- **Abhängigkeiten:** Dependabot + `dependabot/fetch-metadata` liefert `update-type`; Auto-Merge für `semver-patch`/`-minor` via `gh pr merge --auto`, braucht `pull-requests: write`, `contents: write`, Repo-Einstellung „Allow auto-merge" und Branch-Schutz mit Pflicht-Checks. **Achtung für MAKE OS:** Auto-Merge auf `main` löst das Ausrollen aus — also Ziel-Branch `entwicklung` oder Auto-Merge aus. Renovate hat Automerge/Gruppierung eingebaut, wenn Dependabot zu grob wird. [51][52][53]
- Ein wöchentlicher „Code-Rundgang" des HOI (Knip + npm audit + OSV + tsc-Warnungen + Testabdeckungs-Trend) wird zur Kennzahl „Code-Gesundheit" mit Ampel; Vorschläge landen im Freigabe-Stapel wie bei den anderen Heads. [49][31]

**Quellen**
45. Claude Code Action — Anthropic (GitHub), 2026, https://github.com/anthropics/claude-code-action
46. About Copilot code review — GitHub Docs, 2026, https://docs.github.com/en/copilot/concepts/code-review/code-review
47. CodeRabbit vs GitHub Copilot Code Review (2026): Benchmarks, Pricing — Morph, 2026, https://www.morphllm.com/comparisons/coderabbit-vs-copilot
48. Claude Code Review vs. CodeRabbit vs. Copilot vs. Bugbot — whitefox, 2026, https://www.whitefox.cloud/articles/claude-code-review-vs-coderabbit-copilot-bugbot/
49. Knip — Declutter your JavaScript & TypeScript projects — knip.dev, 2025, https://knip.dev/
50. Knip vs depcheck: Finding Unused Dependencies in 2026 — PkgPulse, 2026, https://www.pkgpulse.com/guides/knip-vs-depcheck-2026
51. dependabot/fetch-metadata — GitHub, 2025, https://github.com/dependabot/fetch-metadata
52. Automatically merging dependabot PRs — Will Larson (lethain.com), 2025, https://lethain.com/dependabot-auto-merge/
53. Bot comparison (Renovate vs Dependabot) — Renovate Docs, 2025, https://docs.renovatebot.com/bot-comparison/

---

## 5 · Observability auf kleinem Server

**Erkenntnisse**
- **Logs:** Docker `json-file` ist standardmäßig **unbegrenzt** (`max-size` = -1); `max-file` wirkt nur mit `max-size`; nach Änderung müssen Container neu erstellt werden. In `compose.yml` je Dienst `logging: {driver: json-file, options: {max-size: "10m", max-file: "3"}}`. Volle Platte durch Logs ist ein klassischer Ausfall. [54]
- **Metriken ohne Prometheus:** `docker stats --no-stream --format json` liefert CPU %, Speicher/Grenze, Netz, Block-I/O, PIDs je Container — ein Cron-Skript auf dem Host genügt für die Ampel. `df`, `free`, `loadavg` dazu. [55]
- **Node-Fehlerfänger:** `uncaughtException` → nur synchron aufräumen, dann **abstürzen lassen** (Docker `restart: unless-stopped` startet neu); `unhandledRejection` beendet seit Node 15 ohnehin den Prozess; Handler nur zum Protokollieren, nie zum Weiterlaufen. `uncaughtExceptionMonitor` erlaubt Mitschreiben ohne das Standardverhalten zu ändern. [56][57]
- **Container-Gesundheit:** Docker startet **nicht** neu, wenn der Healthcheck fehlschlägt — nur wenn der Prozess endet. Abhilfe deterministisch: `docker-autoheal` (Label `autoheal=true`) oder ein Healthcheck, der den Prozess beendet. Das ist „Self-healing mit Grenzen" ohne LLM. [59]
- **Zertifikat:** Caddy erneuert bei ⅓ Restlaufzeit (~30 Tage bei 90-Tage-Zertifikaten; ARI kann das Fenster verschieben). Außenprüfung alarmiert bei < 14 Tagen — dann ist die Erneuerung bereits zweimal gescheitert. [58][11]
- **Leichter Sammler mit Oberfläche:** Beszel (Hub + Agent, PocketBase, <10 MB Agent) misst CPU/RAM/Platte/Netz/Docker-Container/Temperatur, Alarme an viele Kanäle — für 2 GB deutlich passender als Netdata (150–500 MB RAM). Vector (Rust, ein Binary, `docker_logs`/`journald`-Quellen) nur, wenn Logs weitergeleitet/redigiert werden müssen. [60][61][62][63]
- **Erst-Befund aus `compose.yml`:** Summe der `mem_limit` (1536 + 512 + 256 = 2304 MB) übersteigt die 2 GB des Servers. Limits sind Deckel, keine Reservierung — aber der HOI muss Swap/OOM-Kills beobachten, und die Deckel sollten in Summe unter dem physischen Speicher liegen. [55]
- **Statusseite:** Better Stack/UptimeRobot liefern sie kostenlos mit (Feld 1); eine eigene (Uptime Kuma/Gatus) erst mit zweitem Standort. [10][1][2]

**Quellen**
54. JSON File logging driver — Docker Docs, 2025, https://docs.docker.com/engine/logging/drivers/json-file/
55. docker container stats — Docker Docs, 2025, https://docs.docker.com/reference/cli/docker/container/stats/
56. Process: `uncaughtException`, `unhandledRejection` — Node.js Docs v26, 2026, https://nodejs.org/api/process.html
57. Let It Crash: Best Practices for Handling Node.js Errors on Shutdown — Heroku, 2025, https://www.heroku.com/blog/best-practices-nodejs-errors/
58. Automatic HTTPS & `renewal_window_ratio` — Caddy Docs, 2025, https://caddyserver.com/docs/automatic-https · https://caddyserver.com/docs/caddyfile/options
59. docker-autoheal — Monitor and restart unhealthy docker containers — willfarrell (GitHub), 2025, https://github.com/willfarrell/docker-autoheal
60. Beszel — Lightweight server monitoring hub — henrygd (GitHub), 2026, https://github.com/henrygd/beszel
61. Beszel vs Netdata: 10MB Agent vs 500MB Agent (2026) — Instapods, 2026, https://instapods.com/apps/beszel/vs/netdata/
62. Vector — A lightweight, ultra-fast tool for building observability pipelines — vector.dev, 2025, https://vector.dev/
63. netdata — GitHub, 2025, https://github.com/netdata/netdata

---

## 6 · Governance: Rollen, Schlüssel, Protokoll, DSGVO

**Erkenntnisse**
- **Rolle:** Der HOI ist Stufe L1–L2 (Google): untersuchen, bewerten, vorschlagen, Freigaben einholen. Er bekommt eine **eigene Identität** (eigener Dienstschlüssel `MAKE_OS_KEY_HOI`, nur für `/api/system/*` und `/api/hoi/*`), keine Shell, kein Docker-Socket, kein Deploy-Schlüssel. Alles, was Produktion ändert, läuft über einen getrennten, deterministischen Pfad (Host-Cron/Action mit Whitelist) — „Denken ≠ Handeln". [35][44][33]
- **Least Agency:** Autonomie wird verdient, nicht voreingestellt; Freigabe-Workflow für wirkmächtige Aktionen; Not-Aus (Schlüssel ungültig machen, Takt abschalten). Das entspricht 1:1 der bestehenden `autonomie.ts`-Logik der Heads (intern-rücknehmbar automatisch, Außenwirkung zur Freigabe). [44][35]
- **Schlüssel-Hygiene:** GitHub-Secrets minimal, `permissions` je Job, Actions per SHA; Fremddienst-Konten (Healthchecks, Better Stack) auf Kevins Adresse; Telegram-Bot-Token nur in `app`, nicht im `arbeiter` (so ist es bereits); Rotation halbjährlich mit Protokolleintrag. [28][29][30]
- **Audit-Trail:** Jeder HOI-Lauf → Protokoll (Eingaben-Hash, Befunde, Vorschläge, Entscheidung, Zeit) — fälschungssicher genug durch append-only-Datei + tägliche Sicherung; wöchentliche Rechte-Prüfung (welche Schlüssel existieren, wann zuletzt benutzt). [44][35]
- **Bericht an Kevin:** Montag 07:00, fünf Ampeln (Verfügbarkeit · Sicherheit · Sicherung · Code-Gesundheit · Kosten), Handlungen der Woche, offene Freigaben, ein Satz „Was ich nächste Woche tue". Kurz genug fürs Telefon; Details in der App. Bei Rot sofort, sonst nie zwischendurch (Alarmmüdigkeit). [32][39]
- **DSGVO:** Anlasslose Speicherung voller IP-Adressen in Web-Logs ist umstritten bis unzulässig (Dr. DSGVO: ohne Anlass nicht notwendig; BayLDA-Sicht „30 Tage" wird kritisiert; häufig genannt: 7 Tage). Löschfristen **vor** Beginn der Protokollierung festlegen (Protokollierungskonzept), Zweck: Sicherheit nach Art. 32 DSGVO. Für MAKE OS: Caddy-Zugriffslogs mit gekürzten IPs (letztes Oktett 0) und 7 Tagen; bei Angriff verlängerbar mit Vermerk. [64][65][66]
- **Keine Inhalte in Logs oder im HOI-Eingang:** Der HOI sieht Zähler, Status-Codes, Pfade ohne Query-Strings, Container-Namen, Zertifikatsdaten — nie Nachrichten, Kontakte, Finanzdaten (Malins/Kevins private Daten). Das ist zugleich die wirksamste Verteidigung gegen Log-Injection. [34][33][65]

**Quellen**
64. Webseiten-Logfiles: Welche Speicherdauer ist zulässig? — Dr. DSGVO, 2025, https://dr-dsgvo.de/webseiten-logfiles-welche-speicherdauer-ist-zulaessig-eine-datenschutzfrage/
65. Protokollierung datenschutzgerecht gestalten — Dr. Datenschutz (intersoft consulting), 2024, https://www.dr-datenschutz.de/protokollierung-datenschutzgerecht-gestalten/
66. Datenschutz bei Server-Logfiles — datenschutz.org, 2026, https://www.datenschutz.org/logfiles/

---

## Bester Fall für MAKE OS — Bauplan des HOI in drei Stufen

**Leitbild:** Der HOI ist der fünfte Head. Er **liest** drei Quellen (Server-Lage, Außenblick, CI-Ergebnis), bewertet gegen Schwellen, schreibt Befunde + Vorschläge ins bestehende Schema (`pruefer.ts`) und in den Freigabe-Stapel, meldet Rot sofort per Telegram und berichtet montags. Er hat **keine Shell, keinen Docker-Socket, keinen Deploy-Schlüssel**. Was Produktion verändert, tun deterministische Skripte mit Whitelist — oder Kevin. Regelkreis: Kennzahl → Abweichung → Vorschlag → Freigabe → Wirkung → Lernen.

### Stufe A — sofort, 0 € (≈ 18 h)

| # | Baustein | Wie (Tool/Route/Cron) | Wo läuft es | Alarmweg | Agent allein? | h | Quellen |
|---|---|---|---|---|---|---|---|
| A1 | Außenwächter HTTPS | Better Stack Free: HTTPS-Monitor auf `/anmelden` (Status 200 + Schlüsselwort), TLS-Ablauf, 3-Minuten-Takt, Statusseite | externer Dienst | Telegram (Bot-Token + Chat-ID) + E-Mail | nur lesen | 0,5 | 10, 12, 13 |
| A2 | Dead-Man für Sicherung & Vault-Abgleich | Healthchecks.io: 2 Checks; in `deploy/sicherung.sh` und `vault-abgleich.sh` am Ende `curl -fsS -m 10 --retry 5 -o /dev/null $HC_URL`, Fehlerpfad `/fail`; Grace 3 h | Server-Cron (bestehend) + externer Dienst | Telegram + E-Mail | — | 0,5 | 5, 6 |
| A3 | Außenprüfung tief | neue Action `hoi-aussenblick.yml`: `schedule: '17 */6 * * *'` + `workflow_dispatch`; curl Status/Antwortzeit/Header-Liste, `openssl s_client` Zertifikatsrest, wöchentlich Observatory-API-Scan; Ergebnis als JSON → `POST /api/hoi/aussen` (Bearer `HOI_TOKEN`); bei Rot direkt Telegram `sendMessage` (unabhängig vom Server); Actions per SHA, `permissions: contents: read` | GitHub Action | Telegram | nur lesen | 3 | 7, 8, 9, 14, 28, 29 |
| A4 | Lage-Sammler auf dem Host | `deploy/lage-sammeln.sh` (Cron `*/5`): `df`, `free`, loadavg, `docker ps --format json` (Health), `docker stats --no-stream --format json`, `fail2ban-client status sshd` (nur Zähler), `journalctl -u ssh --since -24h` (Zähler), `apt list --upgradable` (Zähler), `/var/run/reboot-required`, Sicherungs-Alter/-Größe, Zertifikatsrest → `/srv/make-os/daten/system/lage.json` (+ 7 Tage Verlauf, IPs gekürzt) | Server-Cron (Host, nicht Container) | — (Rohdaten) | — | 3 | 55, 27, 54, 64 |
| A5 | Log-Rotation + Fehlerfänger | `compose.yml`: `logging max-size 10m / max-file 3` für alle drei Dienste; in `app` und `worker.mjs`: `process.on('unhandledRejection'/'uncaughtException')` → Protokollzeile → `exit(1)` (Docker startet neu) | Server (Compose) | — | — | 1 | 54, 56, 57 |
| A6 | CI-Sicherheitsstufe | in `pruefen-und-ausrollen.yml` neuer Job `sicherheit` (parallel zu `pruefen`, nicht blockierend in Woche 1): `npm audit --audit-level=high`, gitleaks-action, Trivy `fs` + Bild (SARIF, `ignore-unfixed`), OSV-Scanner, `npx knip --reporter json`; Ergebnisse als Artefakt + `POST /api/hoi/ci` | GitHub Action | über HOI (A7) | nur lesen | 2 | 17, 18, 19, 22, 49 |
| A7 | HOI als fünfter Head | `lib/heads`: `HeadId 'it'`, Prompt „Head of IT" (Sie/Du wie andere Heads), Takt 06:30 täglich + bei Rot aus A3/A4; Datenpaket = `lage.json` + `aussen.json` + `ci.json` (gekürzt, als Daten markiert); Grundlauf (Regelwerk-Schwellen: Platte > 80 %, RAM > 85 %, Zertifikat < 14 d, Health ≠ healthy, Sicherung > 26 h, Hardening < 80, Observatory < B, CVE high > 0) liefert Befunde auch ohne Modell; Ausgabe nur über `pruefer.ts`-Schema; Vorschläge → Freigabe-Stapel/Aufgaben (`autonomie.ts`: nur `aufgabe`, nie Außenwirkung); eigener Schlüssel `MAKE_OS_KEY_HOI` | Server-Worker (`arbeiter`) | Telegram bei Rot | Befunde schreiben, Aufgaben anlegen — sonst nichts | 6 | 31, 33, 34, 35, 37, 44 |
| A8 | Wochenbericht | Takt Montag 07:00: fünf Ampeln, Handlungen, offene Freigaben, Vorschau; Telegram-Kurzfassung + Seite in der App; Protokolleintrag je Lauf | Server-Worker | Telegram | ja (nur Bericht) | 2 | 32, 36, 39 |

### Stufe B — kleiner Aufwand (≈ 17 h, 0–4 €/Monat)

| # | Baustein | Wie | Wo | Alarmweg | Agent allein? | h | Quellen |
|---|---|---|---|---|---|---|---|
| B1 | Abhängigkeits-Bot | `.github/dependabot.yml`: npm + github-actions, wöchentlich, gruppiert, `target-branch: entwicklung`; optional Auto-Merge nur `semver-patch` für devDependencies nach grünem CI (fetch-metadata + `gh pr merge --auto`), niemals auf `main` | GitHub | HOI-Bericht | Vorschlag; Merge nur nach Regel/Kevin | 1,5 | 51, 52, 53 |
| B2 | Code-Reviewer | Claude Code Action: `pull_request` nach `entwicklung` → Review-Kommentare; monatlicher `schedule` „Tech-Debt-Rundgang" (Knip-Befunde, Zyklen, TODOs) → Issue/Bauplan-Eintrag; `claude_args` ohne Schreibwerkzeuge auf `main`; Kostendeckel über bestehende Anthropic-Schranke | GitHub Action | HOI-Bericht | kommentieren, Vorschlag; kein Commit auf `main` | 3 | 45, 47, 48, 31 |
| B3 | CSP mit Meldeendpunkt | `middleware.ts`: Nonce, `Content-Security-Policy … report-to csp`, `Reporting-Endpoints: csp="/api/hoi/csp"`; Endpunkt zählt je Direktive/Quelle (ohne Query, ohne Body-Speicherung), 7 Tage; Observatory-Note als KPI | App | HOI (gelb bei Anstieg) | zählen | 4 | 23, 24, 14 |
| B4 | Host-Audit | Lynis wöchentlich `--cronjob` (Sonntag 04:00) → Hardening-Index in `lage.json`; < 80 gelb, < 70 rot | Server-Cron | HOI | lesen | 1,5 | 20, 21 |
| B5 | Restore-Probe + Außer-Haus-Kopie | monatlich `deploy/sicherung-pruefen.sh` **auf Kevins Mac** (nur dort liegt der age-Schlüssel): jüngste `.age` per SSH holen, entschlüsseln, `tar -t`, jede JSON-Datei parsen, Anzahl/Größe mit Manifest vergleichen → Healthchecks-Check „Restore" (Periode 31 d); zweite Kopie: Hetzner Storage Box (rclone, ~4 €) **oder** Kevins Mac zieht nächtlich (0 €) | Kevins Mac + externer Dienst | Telegram + E-Mail | — | 3 | 25, 26, 5 |
| B6 | Deterministisches Autoheal | `docker-autoheal` als vierter Dienst (Label `autoheal=true` an `app`/`arbeiter`), Docker-Socket **nur** dort, read-only; Zähler in `lage.json`; ≥ 3 Neustarts/Stunde → Rot | Server (Compose) | HOI → Telegram | ja (regelbasiert, kein LLM) | 1 | 59 |
| B7 | Metrik-Oberfläche | Beszel Hub + Agent (Docker, ~10 MB), Speichergrenzen-Summe unter 2 GB bringen (z. B. app 1280 · arbeiter 384 · caddy 128 · beszel 128), Alarme RAM/Platte/Container an Telegram | Server (Compose) | Telegram | lesen | 2 | 60, 61, 55 |
| B8 | TLS-Tiefenprüfung | monatlich testssl.sh (Docker) in `hoi-aussenblick.yml` → Note/Schwächen als JSON; SSL Labs nur manuell/vierteljährlich (Kontingente) | GitHub Action | HOI | lesen | 1 | 15, 16 |

### Stufe C — später (≈ 21 h)

| # | Baustein | Wie | Wo | Alarmweg | Agent allein? | h | Quellen |
|---|---|---|---|---|---|---|---|
| C1 | Eigener Außenwächter + Statusseite | Gatus (YAML im Repo) oder Uptime Kuma auf **zweitem Standort** (Mini-VPS/Raspberry bei Kevin); ersetzt Better Stack, Statusseite unter eigener Domain | zweiter Standort | Telegram | lesen | 3 | 1, 2, 3, 4 |
| C2 | Log-Pipeline mit Redaktion | Vector: `docker_logs`/`journald` → VRL-Redaktion (IP kürzen, Query entfernen) → Datei 7 Tage / Objektspeicher; ersetzt json-file, wenn Auswertung nötig | Server | — | — | 4 | 62, 64, 65 |
| C3 | Stufe L3: gebundene Aktionen | HOI darf definierte Runbook-Aktionen **anfordern** (Container-Neustart, Log-Bereinigung, `apt upgrade` Sicherheitsupdates); ein Host-Cron „Aktuator" liest `daten/system/auftraege.json`, prüft Whitelist + Signatur + Rate-Limit + Trockenlauf, führt aus, protokolliert; „Rote Taste" = Schlüssel ungültig; Freischaltung erst nach 3 Monaten gemessener Trefferquote der Befunde | Server-Cron (getrennt vom Agenten) | Telegram vor/nach | nur Whitelist, begrenzt | 8 | 35, 39, 41, 44 |
| C4 | Runbooks + Postmortem-Vorlage | `docs/runbooks/` (Platte voll, Zertifikat, Container tot, Sicherung fehlt, Brute-Force) + Postmortem-Vorlage; HOI füllt nach Vorfall den Entwurf, Kevin schließt ab | Repo | — | Entwurf | 2 | 36 |
| C5 | Evals & Lernen | HOI-Befunde gegen Kevins Bewertung („passt / passt nicht", wie `lernen.ts`), monatliche Trefferquote als KPI; Modellwahl/Kosten je Lauf messen | Server-Worker | Bericht | ja | 4 | 35, 38, 32 |

**Erwartete Laufkosten:** Stufe A 0 € (API-Kosten HOI ≈ 1 Lauf/Tag + Rot-Fälle, wenige Euro/Monat innerhalb der bestehenden Schranke); Stufe B 0–4 €/Monat (nur wenn Storage Box); Stufe C je nach zweitem Standort 0–5 €/Monat.

---

## Offene Entscheidungen für Kevin

1. **Externer Wächter (A1):** ○ Better Stack Free (10 Monitore, 3 min, Statusseite inklusive) — Empfehlung · ○ UptimeRobot Free (50 Monitore, 5 min) · ○ nur GitHub-Action-Cron (0 Konten, aber 5–30 min Verzug und kein Sofort-Alarm).
2. **Alarmwege:** ○ Telegram allein · ○ Telegram + E-Mail als Rückfall — Empfehlung · ○ zusätzlich Malin bei Rot? · Nachtruhe 23–7 Uhr für Gelb, Rot immer?
3. **Autonomie-Stufe des HOI:** ○ L1 nur Vorschläge (Stufe A) · ○ L1 + deterministisches Autoheal ohne LLM (B6) — Empfehlung · ○ L3 mit Aktuator und Whitelist erst nach Bewährung (C3) · ○ nie mehr als Vorschläge.
4. **Abhängigkeits-Updates (B1):** ○ Dependabot nur PRs nach `entwicklung`, Kevin merged — Empfehlung · ○ Auto-Merge für Patch-Updates von devDependencies nach grünem CI · ○ Renovate statt Dependabot · ○ aus.
5. **Sicherung außer Haus + Restore-Probe (B5):** ○ Kevins Mac zieht nächtlich per SSH (0 €, hängt am Mac) · ○ Hetzner Storage Box via rclone (~4 €/Monat, unabhängig) — Empfehlung · ○ beides. Und: Restore-Probe monatlich auf dem Mac (Schlüssel bleibt allein bei Kevin) — ja/nein?
6. **Code-Reviewer (B2):** ○ Claude Code Action mit eigenem API-Schlüssel (im Haus, Kostendeckel) — Empfehlung · ○ Copilot Code Review (Pro-Lizenz nötig) · ○ CodeRabbit · ○ kein Bot, nur der monatliche HOI-Rundgang.
7. **Log-Aufbewahrung (Feld 6):** ○ Caddy-Zugriffslogs aus · ○ 7 Tage mit gekürzten IPs — Empfehlung · ○ 30 Tage voll (BayLDA-Lesart, rechtlich angreifbar).

---
*Quellenzahl geprüft: 66 nummerierte Einträge (Felder 1–6). Alle URLs am 26.09.2026 per WebSearch/WebFetch aufgerufen; Kernaussagen (API-Endpunkte, Freikontingente, Zahlen aus LogJack/Anthropic/Google SRE) gegen die Primärseiten verifiziert.*
