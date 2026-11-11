// Rundgang der Beispielseite Hellgrund: drei kurze Einstellungen (Haus, Raum, Licht) laufen stumm nacheinander
// und blenden weich ineinander. Geladen wird erst, wenn der Film in Sichtnähe kommt, jede weitere Einstellung
// erst, während die vorige läuft. Außerhalb des Bilds steht alles still. Lädt ein Clip nicht, bleibt sein Poster.

const BLENDE = 1000; // Millisekunden, passend zur Übergangszeit in seite.css

export class Rundgang {
  /**
   * @param {object} teile
   * @param {HTMLVideoElement[]} teile.filme   die Einstellungen in Reihenfolge
   * @param {HTMLButtonElement[]} teile.stationen  je Einstellung ein Knopf mit Laufbalken (.st-lauf i)
   * @param {HTMLButtonElement} teile.knopf    Anhalten / Abspielen
   * @param {HTMLElement} teile.knopfText
   * @param {boolean} teile.vonSelbst          true: läuft, sobald er im Bild ist; false: erst nach Klick
   * @param {(text: string) => void} teile.melde
   * @param {(zustand: {angehalten: boolean, laeuft: boolean}) => void} [teile.beiWechsel]
   */
  constructor({ filme, stationen, knopf, knopfText, vonSelbst, melde, beiWechsel }) {
    this.filme = filme;
    this.stationen = stationen;
    this.balken = stationen.map((s) => s.querySelector('.st-lauf i'));
    this.knopf = knopf;
    this.knopfText = knopfText;
    this.melde = melde;
    this.beiWechsel = beiWechsel || (() => {});
    this.aktiv = 0;
    this.imBild = false;
    this.angehalten = !vonSelbst;
    this.startet = false;
    this.wechselt = false;
    this.kaputt = filme.map(() => false);
    this.uhr = 0;
    this.gestoppt = false;
    this.anteil = -1;

    filme.forEach((film, i) => {
      film.removeAttribute('controls');
      film.controls = false;
      film.muted = true;
      const fehler = () => this.fehler(i);
      film.addEventListener('error', fehler);
      const quelle = film.querySelector('source');
      if (quelle) quelle.addEventListener('error', fehler);
      film.addEventListener('playing', () => { if (i === this.aktiv) this.zeige(); });
      film.addEventListener('pause', () => { if (i === this.aktiv) this.zeige(); });
    });
    stationen.forEach((s, i) => s.addEventListener('click', () => this.gehe(i)));
    knopf.addEventListener('click', () => this.umschalten());
    document.addEventListener('visibilitychange', () => this.schritt());
    this.marken();
    this.zeige();
  }

  /** Läuft die gezeigte Einstellung gerade wirklich? */
  get laeuft() { return !this.filme[this.aktiv].paused; }

  fehler(i) {
    if (this.kaputt[i]) return;
    this.kaputt[i] = true;
    if (this.kaputt.every(Boolean)) this.angehalten = true;
    if (i === this.aktiv) {
      this.melde('Der Film konnte nicht geladen werden. Das Standbild bleibt stehen, die übrige Seite funktioniert.');
      const n = this.naechste();
      if (n !== i) this.gehe(n); else { this.angehalten = true; this.zeige(); }
    }
  }

  poster(i) {
    const film = this.filme[i];
    const pfad = film.dataset.poster;
    if (pfad && !film.getAttribute('poster')) film.setAttribute('poster', pfad);
  }

  /** Holt eine Einstellung ins Haus (Poster und Filmdaten), ohne sie zu zeigen. */
  lade(i) {
    const film = this.filme[i];
    if (this.kaputt[i] || film.dataset.geladen) return;
    film.dataset.geladen = '1';
    this.poster(i);
    film.preload = 'auto';
    // Die meisten Browser beginnen jetzt von selbst zu laden. Wer es nicht tut, wird kurz darauf angestoßen
    // (ohne eine schon laufende Anfrage abzubrechen).
    setTimeout(() => {
      if (this.gestoppt || film.readyState > 0 || film.networkState === 2 || !film.paused) return;
      try { film.load(); } catch (fehler) { /* Poster bleibt */ }
    }, 600);
  }

  naechste() {
    const n = this.filme.length;
    for (let d = 1; d <= n; d++) {
      const i = (this.aktiv + d) % n;
      if (!this.kaputt[i]) return i;
    }
    return this.aktiv;
  }

  spiele(film) {
    let zusage;
    try { zusage = film.play(); } catch (fehler) { return Promise.reject(fehler); }
    return zusage && zusage.then ? zusage : Promise.resolve();
  }

  /** Wechselt weich zu einer Einstellung (von selbst am Ende oder per Knopf). */
  gehe(n) {
    if (this.gestoppt || n === this.aktiv || this.kaputt[n]) return;
    const alt = this.filme[this.aktiv];
    const neu = this.filme[n];
    clearTimeout(this.uhr);
    this.filme.forEach((film) => {
      if (film === alt || film === neu) return;
      film.classList.remove('an', 'vorn');
      if (!film.paused) film.pause();
    });
    this.poster(n);
    try { if (neu.readyState > 0) neu.currentTime = 0; } catch (fehler) { /* läuft dann ab der alten Stelle */ }
    alt.classList.remove('vorn');
    neu.classList.add('vorn', 'an');
    this.aktiv = n;
    this.wechselt = true;
    this.anteil = -1;
    this.marken();
    this.schritt();
    this.uhr = setTimeout(() => {
      this.wechselt = false;
      this.filme.forEach((film, i) => {
        if (i === this.aktiv) return;
        film.classList.remove('an', 'vorn');
        if (!film.paused) film.pause();
        try { if (film.readyState > 0) film.currentTime = 0; } catch (fehler) { /* unwichtig */ }
      });
    }, BLENDE + 150);
  }

  umschalten() {
    if (this.gestoppt) return;
    this.angehalten = !this.angehalten;
    if (!this.angehalten) this.lade(this.aktiv);
    this.schritt();
    this.zeige();
  }

  /** Meldet, ob der Film gerade im Bild ist. Außerhalb steht er still. */
  sichtbar(an) {
    if (an === this.imBild) return;
    this.imBild = an;
    this.schritt();
  }

  /** Vorbereiten, kurz bevor der Film ins Bild kommt. */
  vorbereiten() {
    if (this.gestoppt || this.angehalten) return;
    this.lade(this.aktiv);
  }

  /** Einmal je Bild (oder nach einem Ereignis): starten, anhalten, weiterblenden, Laufbalken zeichnen. */
  schritt() {
    if (this.gestoppt) return;
    const film = this.filme[this.aktiv];
    const soll = this.imBild && !this.angehalten && !document.hidden && !this.kaputt[this.aktiv];
    if (soll) {
      if (film.paused && !this.startet) {
        this.startet = true;
        this.lade(this.aktiv);
        this.spiele(film).then(
          () => { this.startet = false; },
          () => { this.startet = false; this.angehalten = true; this.zeige(); },
        );
      }
    } else {
      for (const f of this.filme) if (!f.paused) f.pause();
    }
    const dauer = film.duration;
    if (!(dauer > 0)) { this.zeichne(0); return; }
    const zeit = film.currentTime;
    this.zeichne(zeit / dauer);
    if (!soll || film.paused) return;
    const n = this.naechste();
    if (n === this.aktiv) return;
    if (zeit > 0.5) this.lade(n);
    if (!this.wechselt && zeit >= dauer - BLENDE / 1000 - 0.08 && this.filme[n].readyState >= 3) this.gehe(n);
  }

  zeichne(anteil) {
    const w = Math.min(1, Math.max(0, anteil));
    if (Math.abs(w - this.anteil) < 0.002) return;
    this.anteil = w;
    const b = this.balken[this.aktiv];
    if (b) b.style.setProperty('transform', `scaleX(${w.toFixed(3)})`);
  }

  marken() {
    this.stationen.forEach((s, i) => {
      s.setAttribute('aria-pressed', String(i === this.aktiv));
      if (i !== this.aktiv && this.balken[i]) this.balken[i].style.removeProperty('transform');
    });
  }

  zeige() {
    const haelt = this.angehalten;
    this.knopf.classList.toggle('pausiert', haelt);
    const text = haelt ? 'Film abspielen' : 'Film anhalten';
    this.knopf.setAttribute('aria-label', text);
    this.knopfText.textContent = text;
    this.beiWechsel({ angehalten: haelt, laeuft: this.laeuft });
  }

  /** Notaus: alles anhalten, nur die erste Einstellung mit Bedienleiste des Browsers zeigen. */
  stopp() {
    this.gestoppt = true;
    clearTimeout(this.uhr);
    this.filme.forEach((film, i) => {
      if (!film.paused) film.pause();
      film.classList.toggle('an', i === 0);
      film.classList.toggle('vorn', i === 0);
    });
    this.filme[0].controls = true;
  }
}
