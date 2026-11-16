// Tout ce qui est commun aux trois jeux : navigation, progression, écran de victoire.
// Chaque jeu s'enregistre avec Hub.enregistrer() et ne s'occupe que de son plateau.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const CLE_STOCKAGE = 'points-lies';
  const jeux = new Map();
  const $ = (id) => document.getElementById(id);

  // La progression vit dans le navigateur ; si le stockage est refusé
  // (navigation privée), on joue quand même, sans mémoire.
  function lireProgression() {
    try { return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || {}; } catch { return {}; }
  }
  function noterReussite(cle, n) {
    const p = lireProgression();
    p[cle] = [...new Set([...(p[cle] || []), n])].sort((a, b) => a - b);
    try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(p)); } catch { /* sans mémoire */ }
  }
  const finis = (cle) => new Set(lireProgression()[cle] || []);
  // Un niveau s'ouvre quand le précédent est réussi.
  const ouvert = (cle, n) => n === 1 || finis(cle).has(n - 1) || finis(cle).has(n);

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

  function montrer(id) {
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
      const total = j.niveaux.length, faits = finis(j.cle).size;
      const a = document.createElement('a');
      a.className = 'carte';
      a.href = '#' + j.cle;
      a.style.setProperty('--c', `var(--${j.cle})`);
      a.innerHTML = `${j.illustration}<div class="carte-corps"><h2>${j.titre}</h2><p>${j.accroche}</p>
        <div class="avancee"><div class="jauge"><span style="width:${(100 * faits) / total}%"></span></div>${faits} / ${total}</div></div>`;
      cartes.appendChild(a);
    }
    montrer('vue-accueil');
  }

  function listeNiveaux(j) {
    document.body.dataset.jeu = j.cle;
    document.title = j.titre + ' · Points Liés';
    $('niveaux-titre').textContent = j.titre;
    $('niveaux-regle').innerHTML = j.regle;
    const g = $('niveaux-grille');
    g.textContent = '';
    const f = finis(j.cle);
    j.niveaux.forEach((_, i) => {
      const n = i + 1;
      const a = document.createElement('a');
      a.className = 'niveau' + (f.has(n) ? ' fini' : '') + (ouvert(j.cle, n) ? '' : ' ferme');
      a.textContent = n;
      a.href = '#' + j.cle + '-' + n;
      a.setAttribute('aria-label', `Niveau ${n}` + (f.has(n) ? ', réussi' : ouvert(j.cle, n) ? '' : ', verrouillé'));
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
    const svg = $('plateau');
    let gagne = false;
    const ui = {
      compteurs(html) { $('jeu-compteurs').innerHTML = html; },
      message(texte, alerte) {
        const m = $('jeu-message');
        m.textContent = texte || '';
        m.classList.toggle('alerte', !!alerte);
      },
      annulable(oui) { $('bouton-annuler').disabled = !oui; },
      gagner(texte) {
        if (gagne) return;
        gagne = true;
        noterReussite(j.cle, n);
        // Laisse le temps de voir le dernier coup avant d'ouvrir le bilan.
        setTimeout(() => {
          const dernier = n === j.niveaux.length;
          $('victoire-sur').textContent = `${j.titre} · niveau ${n}`;
          $('victoire-titre').textContent = dernier ? 'Tout est fini !' : 'Niveau réussi';
          $('victoire-texte').textContent = dernier ? `${texte} Tu as terminé les ${n} niveaux.` : texte;
          $('victoire-niveaux').href = '#' + j.cle;
          const suivant = $('victoire-suivant');
          suivant.hidden = dernier;
          suivant.href = `#${j.cle}-${n + 1}`;
          $('victoire').hidden = false;
          (dernier ? $('victoire-niveaux') : suivant).focus();
        }, 450);
      },
    };
    function demarrer() {
      svg.textContent = '';
      svg.classList.remove('secoue');
      gagne = false;
      ui.message('');
      ui.annulable(false);
      partie = j.demarrer(structuredClone(j.niveaux[n - 1]), svg, ui);
    }
    demarrer();
    $('bouton-recommencer').onclick = demarrer;
    $('bouton-annuler').onclick = () => { if (!gagne) partie.annuler(); };
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
      if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace') { e.preventDefault(); $('bouton-annuler').click(); }
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
