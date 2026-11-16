// Tout ce qui est commun aux trois jeux : navigation, progression, scores, écran de victoire.
// Chaque jeu s'enregistre avec Hub.enregistrer() et ne s'occupe que de son plateau ;
// il signale chaque coup joué par ui.coup(), le reste (chrono, records) est ici.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const CLE_STOCKAGE = 'points-lies';
  const jeux = new Map();
  const $ = (id) => document.getElementById(id);

  // La progression vit dans le navigateur ; si le stockage est refusé
  // (navigation privée), on joue quand même, sans mémoire.
  // Forme : { carres: { "3": { temps: ms, coups: n }, … }, … }
  function lireProgression() {
    let p;
    try { p = JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || {}; } catch { p = {}; }
    // La première version ne gardait que la liste des niveaux réussis : on la reprend
    // sans score, pour ne pas reverrouiller les niveaux de qui jouait déjà.
    for (const [cle, v] of Object.entries(p)) {
      if (Array.isArray(v)) p[cle] = Object.fromEntries(v.map((n) => [n, {}]));
    }
    return p;
  }
  const scores = (cle) => lireProgression()[cle] || {};
  // Garde séparément le meilleur temps et le moins de coups : les deux records
  // ne viennent pas forcément de la même partie.
  function noterReussite(cle, n, temps, coups) {
    const p = lireProgression();
    const tout = (p[cle] = p[cle] || {});
    const avant = tout[n] || {};
    const record = { temps: avant.temps === undefined || temps < avant.temps, coups: avant.coups === undefined || coups < avant.coups };
    tout[n] = { temps: record.temps ? temps : avant.temps, coups: record.coups ? coups : avant.coups };
    try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(p)); } catch { /* sans mémoire */ }
    return { avant, record };
  }
  // Un niveau s'ouvre quand le précédent est réussi.
  const ouvert = (cle, n) => { const s = scores(cle); return n === 1 || !!s[n - 1] || !!s[n]; };

  function duree(ms) {
    const s = Math.floor(ms / 1000);
    return s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  // Temps cumulé des meilleurs temps : ne compte que les niveaux qui ont un temps.
  const tempsTotal = (s) => Object.values(s).reduce((t, v) => t + (v.temps || 0), 0);

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Coordonnées d'un pointeur dans le repère du plateau.
  function position(svg, ev) {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  }

  function enregistrer(cle, def) { jeux.set(cle, { cle, ...def }); }

  let chrono = null;
  function arreterChrono() { if (chrono) { clearInterval(chrono.tic); chrono = null; } }

  function montrer(id) {
    arreterChrono();
    for (const v of document.querySelectorAll('.vue')) v.hidden = v.id !== id;
    $('victoire').hidden = true;
    window.scrollTo(0, 0);
  }

  function accueil() {
    document.body.dataset.jeu = '';
    document.title = 'Points Liés';
    const cartes = $('cartes-jeux');
    cartes.textContent = '';
    for (const j of jeux.values()) {
      const s = scores(j.cle);
      const total = j.niveaux.length, faits = Object.keys(s).length, t = tempsTotal(s);
      const a = document.createElement('a');
      a.className = 'carte';
      a.href = '#' + j.cle;
      a.style.setProperty('--c', `var(--${j.cle})`);
      a.innerHTML = `${j.illustration}<div class="carte-corps"><h2>${j.titre}</h2><p>${j.accroche}</p>
        <div class="avancee"><div class="jauge"><span style="width:${(100 * faits) / total}%"></span></div><span class="avancee-compte">${faits} / ${total}</span></div>
        ${t ? `<p class="carte-temps">Temps cumulé ${duree(t)}</p>` : ''}</div>`;
      cartes.appendChild(a);
    }
    montrer('vue-accueil');
  }

  function listeNiveaux(j) {
    document.body.dataset.jeu = j.cle;
    document.title = j.titre + ' · Points Liés';
    $('niveaux-titre').textContent = j.titre;
    $('niveaux-regle').innerHTML = j.regle;
    const s = scores(j.cle);
    const faits = Object.keys(s).length, t = tempsTotal(s);
    $('niveaux-bilan').innerHTML = faits
      ? `<span><strong>${faits}</strong> / ${j.niveaux.length} réussis</span>${t ? `<span>Temps cumulé <strong>${duree(t)}</strong></span>` : ''}`
      : '';
    $('niveaux-bilan').hidden = !faits;
    const g = $('niveaux-grille');
    g.textContent = '';
    j.niveaux.forEach((_, i) => {
      const n = i + 1, sc = s[n];
      const a = document.createElement('a');
      a.className = 'niveau' + (sc ? ' fini' : '') + (ouvert(j.cle, n) ? '' : ' ferme');
      a.href = '#' + j.cle + '-' + n;
      a.innerHTML = `<span class="niveau-n">${n}</span>${sc && sc.temps !== undefined ? `<span class="niveau-temps">${duree(sc.temps)}</span>` : ''}`;
      a.setAttribute('aria-label', `Niveau ${n}` + (sc ? `, réussi${sc.temps !== undefined ? `, record ${duree(sc.temps)} en ${sc.coups} coups` : ''}` : ouvert(j.cle, n) ? '' : ', verrouillé'));
      g.appendChild(a);
    });
    montrer('vue-niveaux');
  }

  let partie = null;

  function jouer(j, n) {
    document.body.dataset.jeu = j.cle;
    document.title = `${j.titre} ${n} · Points Liés`;
    $('jeu-titre').textContent = `Niveau ${n}`;
    $('jeu-retour').href = '#' + j.cle;
    montrer('vue-jeu');
    const record = scores(j.cle)[n];
    $('jeu-record').textContent = record && record.temps !== undefined ? `Record ${duree(record.temps)} · ${record.coups} coups` : '';
    const svg = $('plateau');
    let gagne = false, coups = 0;

    // Le chrono part au premier coup, pas à l'ouverture : lire le plateau est gratuit.
    // Il ne compte pas le temps passé dans un autre onglet.
    function afficherChrono() {
      const ms = chrono ? chrono.cumul + (chrono.depuis !== null ? performance.now() - chrono.depuis : 0) : 0;
      $('jeu-chrono').innerHTML = `<small>Temps</small>${duree(ms)}`;
      $('jeu-coups').innerHTML = `<small>Coups</small>${coups}`;
      return ms;
    }
    function lancerChrono() {
      if (chrono) return;
      chrono = { cumul: 0, depuis: performance.now(), tic: setInterval(afficherChrono, 250) };
    }

    const ui = {
      compteurs(html) { $('jeu-compteurs').innerHTML = html; },
      message(texte, alerte) {
        const m = $('jeu-message');
        m.textContent = texte || '';
        m.classList.toggle('alerte', !!alerte);
      },
      annulable(oui) { $('bouton-annuler').disabled = !oui; },
      coup() {
        if (gagne) return;
        lancerChrono();
        coups++;
        afficherChrono();
      },
      gagner(texte) {
        if (gagne) return;
        gagne = true;
        const temps = Math.round(afficherChrono());
        arreterChrono();
        const { avant, record: rec } = noterReussite(j.cle, n, temps, coups);
        const premiere = avant.temps === undefined;
        // Laisse le temps de voir le dernier coup avant d'ouvrir le bilan.
        setTimeout(() => {
          const dernier = n === j.niveaux.length;
          $('victoire-sur').textContent = `${j.titre} · niveau ${n}`;
          $('victoire-titre').textContent = dernier ? 'Tout est fini !' : 'Niveau réussi';
          $('victoire-texte').textContent = dernier ? `${texte} Tu as terminé les ${n} niveaux.` : texte;
          $('victoire-temps').innerHTML = `<small>Temps</small>${duree(temps)}${!premiere && rec.temps ? '<em>record</em>' : ''}`;
          $('victoire-coups').innerHTML = `<small>Coups</small>${coups}${!premiere && rec.coups ? '<em>record</em>' : ''}`;
          $('victoire-record').textContent = premiere
            ? 'Premier score enregistré pour ce niveau.'
            : rec.temps || rec.coups
              ? `Ancien record : ${duree(avant.temps)} · ${avant.coups} coups.`
              : `Record à battre : ${duree(avant.temps)} · ${avant.coups} coups.`;
          $('victoire-niveaux').href = '#' + j.cle;
          const suivant = $('victoire-suivant');
          suivant.hidden = dernier;
          suivant.href = `#${j.cle}-${n + 1}`;
          $('victoire').hidden = false;
          (dernier ? $('victoire-niveaux') : suivant).focus();
        }, 450);
      },
    };
    // Recommencer remet le chrono et les coups à zéro : un score vaut pour une partie entière.
    function demarrer() {
      arreterChrono();
      coups = 0;
      svg.textContent = '';
      svg.classList.remove('secoue');
      // Le plateau est le même élément pour les trois jeux : sans ce nettoyage, les gestes
      // d'un jeu ouvert avant capturent le toucher et les traits des Carrés ne répondent plus.
      svg.onpointerdown = svg.onpointermove = svg.onpointerup = svg.onpointercancel = null;
      gagne = false;
      ui.message('');
      ui.annulable(false);
      afficherChrono();
      partie = j.demarrer(structuredClone(j.niveaux[n - 1]), svg, ui);
    }
    demarrer();
    $('bouton-recommencer').onclick = demarrer;
    // Annuler compte comme un coup : le moins de coups récompense une partie sans retour en arrière.
    $('bouton-annuler').onclick = () => { if (!gagne) { partie.annuler(); ui.coup(); } };
  }

  function router() {
    const h = decodeURIComponent(location.hash.slice(1));
    const m = /^([a-z]+)(?:-(\d+))?$/.exec(h);
    const j = m && jeux.get(m[1]);
    if (!j) return accueil();
    const n = m[2] ? Number(m[2]) : 0;
    if (!n || n > j.niveaux.length) return listeNiveaux(j);
    if (!ouvert(j.cle, n)) { location.hash = j.cle; return; }
    jouer(j, n);
  }

  function lancer() {
    window.addEventListener('hashchange', router);
    document.addEventListener('keydown', (e) => {
      if ($('vue-jeu').hidden || !$('victoire').hidden) return;
      if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace') { e.preventDefault(); if (!$('bouton-annuler').disabled) $('bouton-annuler').click(); }
    });
    document.addEventListener('visibilitychange', () => {
      if (!chrono) return;
      if (document.hidden && chrono.depuis !== null) { chrono.cumul += performance.now() - chrono.depuis; chrono.depuis = null; }
      else if (!document.hidden && chrono.depuis === null) chrono.depuis = performance.now();
    });
    router();
  }

  function secouer(svg) {
    svg.classList.remove('secoue');
    void svg.getBoundingClientRect();
    svg.classList.add('secoue');
  }

  window.Hub = { enregistrer, lancer, el, position, secouer };
})();
