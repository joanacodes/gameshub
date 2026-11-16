// Les Ponts : chaque île dit combien de ponts en partent. Il faut tout relier
// en un seul réseau, en ligne droite, sans croisement, au plus deux ponts par paire.
(function () {
  const C = 10;

  function demarrer(niv, svg, ui) {
    const iles = niv.iles;
    const ar = ReglesPonts.aretes(niv.w, niv.h, iles);
    const val = new Array(ar.length).fill(0);
    const pile = [];

    svg.setAttribute('viewBox', `-6 -6 ${(niv.w - 1) * C + 12} ${(niv.h - 1) * C + 12}`);
    const gFond = Hub.el('g', {}, svg);
    const gPonts = Hub.el('g', {}, svg);
    const apercu = Hub.el('line', { class: 'trait-joue', 'stroke-width': 1.2, 'stroke-dasharray': '2 1.6', opacity: 0.7, visibility: 'hidden' }, svg);
    const gZones = Hub.el('g', {}, svg);
    const gIles = Hub.el('g', {}, svg);

    for (let y = 0; y < niv.h; y++) for (let x = 0; x < niv.w; x++) Hub.el('circle', { cx: x * C, cy: y * C, r: 0.7, fill: 'var(--grille)' }, gFond);

    const dessinsPonts = ar.map(() => Hub.el('g', {}, gPonts));
    ar.forEach((e, i) => {
      // Une bande le long du pont : toucher un pont existant le fait passer à double, puis le retire.
      const z = e.horiz
        ? Hub.el('rect', { x: e.x1 * C + 5, y: e.y1 * C - 3, width: (e.x2 - e.x1) * C - 10, height: 6, class: 'zone' }, gZones)
        : Hub.el('rect', { x: e.x1 * C - 3, y: e.y1 * C + 5, width: 6, height: (e.y2 - e.y1) * C - 10, class: 'zone' }, gZones);
      z.addEventListener('click', () => { if (val[i]) basculer(i); });
      z.style.pointerEvents = 'none';
      e.zone = z;
    });

    const dessinsIles = iles.map(([x, y, n]) => {
      const g = Hub.el('g', {}, gIles);
      const rond = Hub.el('circle', { cx: x * C, cy: y * C, r: 4.2, 'stroke-width': 0.9 }, g);
      const t = Hub.el('text', { x: x * C, y: y * C + 0.2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 5, 'font-family': 'var(--titre)', 'font-weight': 600 }, g);
      t.textContent = n;
      return { g, rond, t };
    });

    function dessinerPont(i) {
      const g = dessinsPonts[i], e = ar[i];
      g.textContent = '';
      const [ax, ay] = iles[e.a], [bx, by] = iles[e.b];
      const r = 4.2;
      const x1 = ax * C + (e.horiz ? r : 0), y1 = ay * C + (e.horiz ? 0 : r);
      const x2 = bx * C - (e.horiz ? r : 0), y2 = by * C - (e.horiz ? 0 : r);
      const decal = val[i] === 2 ? [-1.1, 1.1] : val[i] === 1 ? [0] : [];
      for (const d of decal) {
        Hub.el('line', { x1: x1 + (e.horiz ? 0 : d), y1: y1 + (e.horiz ? d : 0), x2: x2 + (e.horiz ? 0 : d), y2: y2 + (e.horiz ? d : 0), class: 'trait-joue', 'stroke-width': 1.2 }, g);
      }
      e.zone.style.pointerEvents = val[i] ? 'auto' : 'none';
    }

    function afficher() {
      const c = ReglesPonts.comptes(iles, ar, val);
      let completes = 0;
      iles.forEach(([, , n], i) => {
        const d = dessinsIles[i];
        const etat = c[i] === n ? 'complete' : c[i] > n ? 'trop' : 'ouverte';
        if (etat === 'complete') completes++;
        // L'état se lit à la forme autant qu'à la couleur : île pleine quand elle est complète,
        // contour pointillé quand elle a trop de ponts.
        d.rond.setAttribute('fill', etat === 'complete' ? 'var(--accent)' : 'var(--surface)');
        d.rond.setAttribute('stroke', etat === 'ouverte' ? 'var(--encre)' : 'var(--accent)');
        d.rond.setAttribute('stroke-dasharray', etat === 'trop' ? '1.6 1.2' : 'none');
        d.rond.setAttribute('stroke-width', etat === 'trop' ? 1.4 : 0.9);
        d.t.setAttribute('fill', etat === 'complete' ? 'var(--accent-texte)' : etat === 'trop' ? 'var(--accent)' : 'var(--encre)');
      });
      ui.compteurs(`<span class="compteur${completes === iles.length ? ' atteint' : ''}"><small>Îles complètes</small>${completes} / ${iles.length}</span>`);
      ui.annulable(pile.length > 0);
      return completes;
    }

    function basculer(i, depuisAnnuler) {
      const avant = val[i], apres = (avant + 1) % 3;
      if (avant === 0 && ar[i].croise.some((j) => val[j] > 0)) {
        ui.message('Les ponts ne se croisent pas.', true);
        Hub.secouer(svg);
        return;
      }
      val[i] = apres;
      ui.coup();
      if (!depuisAnnuler) pile.push({ i, avant });
      dessinerPont(i);
      const completes = afficher();
      if (completes === iles.length) {
        if (ReglesPonts.connexe(iles.length, ar, val)) {
          ui.message('');
          ui.gagner(`Les ${iles.length} îles sont reliées.`);
        } else {
          ui.message('Toutes les îles sont complètes, mais le réseau est coupé en morceaux.', true);
        }
      } else {
        ui.message('');
      }
    }

    function annuler() {
      const c = pile.pop();
      if (!c) return;
      val[c.i] = c.avant;
      dessinerPont(c.i);
      ui.message('');
      afficher();
    }

    // Le pont qui part de l'île a dans une direction, s'il existe.
    function versVoisin(a, dx, dy) {
      return ar.findIndex((e) => (e.a === a || e.b === a) && e.horiz === (dx !== 0) && (e.a === a ? dx + dy > 0 : dx + dy < 0));
    }
    function ileProche(x, y) {
      let best = -1, d = 6;
      iles.forEach(([ix, iy], i) => { const e = Math.hypot(ix * C - x, iy * C - y); if (e < d) { d = e; best = i; } });
      return best;
    }

    let depart = -1, origine = null, cible = -1, choisi = -1;
    function surligner(i) {
      dessinsIles.forEach((d, k) => d.g.style.opacity = i >= 0 && k !== i && !ar.some((e) => (e.a === i && e.b === k) || (e.b === i && e.a === k)) ? 0.45 : 1);
    }
    svg.onpointerdown = (ev) => {
      const [x, y] = Hub.position(svg, ev);
      const i = ileProche(x, y);
      if (i < 0) { choisi = -1; surligner(-1); return; }
      if (choisi >= 0 && choisi !== i) {
        const e = ar.findIndex((f) => (f.a === choisi && f.b === i) || (f.b === choisi && f.a === i));
        choisi = -1; surligner(-1);
        if (e >= 0) { basculer(e); return; }
      }
      depart = i; origine = [x, y]; cible = -1;
      svg.setPointerCapture(ev.pointerId);
    };
    svg.onpointermove = (ev) => {
      if (depart < 0) return;
      const [x, y] = Hub.position(svg, ev);
      const dx = x - origine[0], dy = y - origine[1];
      cible = -1;
      if (Math.hypot(dx, dy) > 3) {
        cible = Math.abs(dx) > Math.abs(dy) ? versVoisin(depart, Math.sign(dx), 0) : versVoisin(depart, 0, Math.sign(dy));
      }
      if (cible >= 0) {
        const e = ar[cible];
        apercu.setAttribute('x1', iles[e.a][0] * C); apercu.setAttribute('y1', iles[e.a][1] * C);
        apercu.setAttribute('x2', iles[e.b][0] * C); apercu.setAttribute('y2', iles[e.b][1] * C);
      }
      apercu.setAttribute('visibility', cible >= 0 ? 'visible' : 'hidden');
    };
    const finir = (ev) => {
      if (depart < 0) return;
      apercu.setAttribute('visibility', 'hidden');
      const a = depart, e = cible, bouge = origine && Math.hypot(...Hub.position(svg, ev).map((v, k) => v - origine[k])) > 3;
      depart = -1; cible = -1;
      if (ev.type === 'pointercancel') return;
      if (e >= 0) { choisi = -1; surligner(-1); basculer(e); return; }
      // Un simple toucher choisit l'île ; toucher ensuite une voisine pose le pont.
      if (!bouge) { choisi = a; surligner(a); }
    };
    svg.onpointerup = finir;
    svg.onpointercancel = finir;

    ar.forEach((_, i) => dessinerPont(i));
    afficher();
    ui.message('Glisse d’une île vers sa voisine pour poser un pont.');
    return { annuler };
  }

  const regle = `<p>Chaque île porte un nombre : c’est le nombre de ponts qui doivent en partir.</p>
    <ul>
      <li>Glisse d’une île vers une voisine (ou touche l’une puis l’autre) : un pont, puis deux, puis aucun.</li>
      <li>Les ponts vont tout droit et ne se croisent jamais. Deux au plus entre deux îles.</li>
      <li>À la fin, toutes les îles forment un seul réseau.</li>
    </ul>
    <p style="margin-top:8px;color:var(--encre-douce)">Astuce : un 4 dans un coin n’a que deux voisines, donc deux ponts doubles.</p>`;

  const illustration = `<svg viewBox="0 0 92 92" aria-hidden="true">
    <g stroke="var(--accent)" stroke-width="3" stroke-linecap="round">
      <path d="M31 15H61M31 21H61M20 29V61M72 29V61M31 72H61"/>
    </g>
    ${[[20, 18, 3, 1], [72, 18, 3, 0], [20, 72, 2, 0], [72, 72, 2, 1]].map(([x, y, n, plein]) => `<circle cx="${x}" cy="${y}" r="11" fill="${plein ? 'var(--accent)' : 'var(--surface)'}" stroke="${plein ? 'var(--accent)' : 'var(--encre)'}" stroke-width="2.5"/><text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="central" font-family="var(--titre)" font-weight="600" font-size="13" fill="${plein ? 'var(--accent-texte)' : 'var(--encre)'}">${n}</text>`).join('')}
  </svg>`;

  Hub.enregistrer('ponts', {
    titre: 'Les Ponts',
    accroche: 'Relie toutes les îles avec le bon nombre de ponts.',
    regle,
    illustration,
    niveaux: Niveaux.ponts,
    demarrer,
  });
})();
