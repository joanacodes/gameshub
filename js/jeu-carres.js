// Les Carrés, en solo : chaque trait coûte une énergie, sauf s'il ferme une case.
// Le joueur doit repérer les couloirs, où un seul trait payé en ferme plusieurs.
(function () {
  const E = 10; // côté d'une case dans le repère du plateau

  function demarrer(niv, svg, ui) {
    const p = ReglesCarres.plateau(niv.c, niv.r, niv.trous);
    const traces = new Set(niv.traces);
    const fermees = new Set();
    const pile = [];
    let energie = niv.energie;

    svg.setAttribute('viewBox', `-7 -7 ${niv.c * E + 14} ${niv.r * E + 14}`);
    const gCases = Hub.el('g', {}, svg);
    const gFantomes = Hub.el('g', {}, svg);
    const gTraits = Hub.el('g', {}, svg);
    const gPoints = Hub.el('g', {}, svg);
    const gZones = Hub.el('g', {}, svg);

    const fantomes = new Map(), traits = new Map(), carres = new Map();
    const points = new Set();
    for (const [l] of p.lignes) {
      const [[x1, y1], [x2, y2]] = p.bouts(l);
      points.add(x1 + ',' + y1); points.add(x2 + ',' + y2);
      fantomes.set(l, Hub.el('line', { x1: x1 * E, y1: y1 * E, x2: x2 * E, y2: y2 * E, class: 'trait-fantome', 'stroke-width': 0.7 }, gFantomes));
      // Zone de toucher en losange, des deux bouts du trait aux centres des cases voisines :
      // les losanges pavent tout le plateau, donc chaque toucher désigne un trait.
      const horiz = y1 === y2;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const a = horiz ? [mx, my - 0.5] : [mx - 0.5, my];
      const b = horiz ? [mx, my + 0.5] : [mx + 0.5, my];
      const z = Hub.el('polygon', { points: [[x1, y1], a, [x2, y2], b].map(([x, y]) => `${x * E},${y * E}`).join(' '), class: 'zone' }, gZones);
      z.addEventListener('pointerenter', () => { if (!traces.has(l)) fantomes.get(l).classList.add('survol'); });
      z.addEventListener('pointerleave', () => fantomes.get(l).classList.remove('survol'));
      z.addEventListener('click', () => tracer(l));
    }
    for (const k of points) {
      const [x, y] = k.split(',').map(Number);
      Hub.el('circle', { cx: x * E, cy: y * E, r: 1.25, class: 'point' }, gPoints);
    }

    function dessinerTrait(l, classe) {
      const [[x1, y1], [x2, y2]] = p.bouts(l);
      traits.set(l, Hub.el('line', { x1: x1 * E, y1: y1 * E, x2: x2 * E, y2: y2 * E, class: classe, 'stroke-width': classe === 'trait-joue' ? 2.2 : 1.8 }, gTraits));
      fantomes.get(l).classList.remove('survol');
    }
    for (const l of traces) dessinerTrait(l, 'trait-pose');

    function fermer(b, nouvelle) {
      const c = p.caseParId.get(b);
      const g = Hub.el('g', {}, gCases);
      Hub.el('rect', { x: c.c * E + 1, y: c.r * E + 1, width: E - 2, height: E - 2, rx: 1.5, class: 'case-fermee' + (nouvelle ? ' nouvelle' : '') }, g);
      Hub.el('rect', { x: c.c * E + E / 2 - 1.3, y: c.r * E + E / 2 - 1.3, width: 2.6, height: 2.6, rx: 0.6, class: 'marque-case' }, g);
      carres.set(b, g);
      fermees.add(b);
    }

    const fermants = () => [...p.lignes.keys()].filter((l) => !traces.has(l) && ReglesCarres.fermerait(p, traces, l).length);

    function afficher() {
      let pips = '';
      for (let i = 0; i < niv.energie; i++) pips += `<span class="pip${i < energie ? '' : ' vide'}"></span>`;
      ui.compteurs(
        `<span class="compteur"><small>Énergie</small><span class="pips" aria-label="${energie} sur ${niv.energie}">${pips}</span></span>` +
        `<span class="compteur${fermees.size >= niv.objectif ? ' atteint' : ''}"><small>Cases</small>${fermees.size} / ${niv.objectif}</span>`
      );
      ui.annulable(pile.length > 0);
    }

    function tracer(l) {
      if (traces.has(l)) return;
      const ferme = ReglesCarres.fermerait(p, traces, l);
      if (!ferme.length && energie === 0) {
        ui.message('Plus d’énergie : seul un trait qui ferme une case reste gratuit.', true);
        Hub.secouer(svg);
        return;
      }
      if (!ferme.length) energie--;
      traces.add(l);
      dessinerTrait(l, 'trait-joue');
      for (const b of ferme) fermer(b, true);
      pile.push({ l, ferme, paye: !ferme.length });
      ui.message(ferme.length ? (ferme.length > 1 ? 'Deux cases d’un coup, gratuit !' : 'Case fermée, trait gratuit.') : '');
      afficher();
      if (fermees.size >= niv.objectif) {
        ui.gagner(`${fermees.size} cases fermées avec ${niv.energie} d’énergie.`);
      } else if (energie === 0 && !fermants().length) {
        ui.message('Plus d’énergie, plus de case à fermer. Annule ou recommence.', true);
      }
    }

    function annuler() {
      const c = pile.pop();
      if (!c) return;
      traces.delete(c.l);
      traits.get(c.l).remove();
      traits.delete(c.l);
      for (const b of c.ferme) { carres.get(b).remove(); carres.delete(b); fermees.delete(b); }
      if (c.paye) energie++;
      ui.message('');
      afficher();
    }

    afficher();
    ui.message(`Ferme ${niv.objectif} cases.`);
    return { annuler };
  }

  const regle = `<p>Relie deux points voisins pour tracer un trait. Une case entourée de quatre traits est fermée.</p>
    <ul>
      <li>Chaque trait coûte <strong>une énergie</strong>.</li>
      <li>Un trait qui <strong>ferme une case</strong> est gratuit.</li>
      <li>Ferme le nombre de cases demandé avant d’être à court.</li>
    </ul>
    <p style="margin-top:8px;color:var(--encre-douce)">Astuce : cherche les couloirs, où chaque case fermée prépare la suivante.</p>`;

  const illustration = `<svg viewBox="0 0 92 92" aria-hidden="true">
    <rect x="18" y="18" width="28" height="28" rx="3" fill="var(--accent-pale)"/>
    <rect x="29" y="29" width="6" height="6" rx="1.5" fill="var(--accent)"/>
    <g stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round">
      <path d="M16 16H48M16 16V48M16 48H48M48 16V48M48 16H76M48 48H76"/>
    </g>
    <g stroke="var(--grille)" stroke-width="3" stroke-linecap="round" stroke-dasharray="0.1 7"><path d="M76 16V48M16 48V76M48 48V76M16 76H76M76 48V76"/></g>
    <g fill="var(--encre)">${[16, 48, 76].flatMap((y) => [16, 48, 76].map((x) => `<circle cx="${x}" cy="${y}" r="3.6"/>`)).join('')}</g>
  </svg>`;

  Hub.enregistrer('carres', {
    titre: 'Les Carrés',
    accroche: 'Ferme des cases en enchaînant les traits gratuits.',
    regle,
    illustration,
    niveaux: Niveaux.carres,
    demarrer,
  });
})();
