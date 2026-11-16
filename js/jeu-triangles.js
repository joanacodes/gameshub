// Triangles : relier des points sans croiser de trait, pour former un nombre
// de triangles donné avec un nombre de traits limité.
(function () {
  const PRISE = 8; // rayon, dans le repère du plateau, où un doigt « attrape » un point

  function demarrer(niv, svg, ui) {
    const nv = ReglesTriangles.niveau(niv.pts, niv.murs);
    const traits = [];
    const voisins = Array.from({ length: nv.n }, () => new Set());
    const pile = [];
    let nbTri = 0;

    svg.setAttribute('viewBox', '-2 -2 104 104');
    const gTri = Hub.el('g', {}, svg);
    const gMurs = Hub.el('g', {}, svg);
    const gTraits = Hub.el('g', {}, svg);
    const apercu = Hub.el('line', { class: 'trait-joue', 'stroke-width': 1.4, 'stroke-dasharray': '2.5 2', opacity: 0.8, visibility: 'hidden' }, svg);
    const anneau = Hub.el('circle', { r: 4.6, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.2, visibility: 'hidden' }, svg);
    const gPoints = Hub.el('g', {}, svg);

    for (const m of niv.murs) {
      Hub.el('line', { x1: m[0], y1: m[1], x2: m[2], y2: m[3], class: 'mur', 'stroke-width': 3.2 }, gMurs);
    }
    nv.pts.forEach(([x, y]) => Hub.el('circle', { cx: x, cy: y, r: 2.4, class: 'point' }, gPoints));

    function afficher() {
      ui.compteurs(
        `<span class="compteur"><small>Traits</small>${traits.length} / ${niv.traits}</span>` +
        `<span class="compteur${nbTri >= niv.objectif ? ' atteint' : ''}"><small>Triangles</small>${nbTri} / ${niv.objectif}</span>`
      );
      ui.annulable(pile.length > 0);
    }

    function proche(x, y) {
      let best = -1, d = PRISE;
      nv.pts.forEach(([px, py], i) => { const e = Math.hypot(px - x, py - y); if (e < d) { d = e; best = i; } });
      return best;
    }

    function relier(i, j) {
      if (traits.length >= niv.traits) {
        ui.message('Plus de trait disponible. Annule ou recommence.', true);
        Hub.secouer(svg);
        return;
      }
      const raison = ReglesTriangles.refus(nv, traits, i, j);
      if (raison) {
        ui.message('Impossible : ' + raison + '.', true);
        Hub.secouer(svg);
        return;
      }
      const tris = ReglesTriangles.nouveauxTriangles(nv, voisins, i, j);
      ui.coup();
      traits.push([i, j]);
      voisins[i].add(j); voisins[j].add(i);
      const ligne = Hub.el('line', { x1: nv.pts[i][0], y1: nv.pts[i][1], x2: nv.pts[j][0], y2: nv.pts[j][1], class: 'trait-joue', 'stroke-width': 1.6 }, gTraits);
      const formes = tris.map((t) => Hub.el('polygon', { points: t.map((k) => nv.pts[k].join(',')).join(' '), class: 'triangle nouveau' }, gTri));
      nbTri += tris.length;
      pile.push({ i, j, ligne, formes, nb: tris.length });
      ui.message(tris.length > 1 ? `${tris.length} triangles d’un coup !` : tris.length ? 'Un triangle.' : '');
      afficher();
      if (nbTri >= niv.objectif) {
        ui.gagner(`${nbTri} triangles en ${traits.length} traits.`);
      } else if (traits.length === niv.traits) {
        ui.message('Plus de trait disponible. Annule ou recommence.', true);
      }
    }

    function annuler() {
      const c = pile.pop();
      if (!c) return;
      traits.pop();
      voisins[c.i].delete(c.j); voisins[c.j].delete(c.i);
      c.ligne.remove();
      c.formes.forEach((f) => f.remove());
      nbTri -= c.nb;
      ui.message('');
      afficher();
    }

    // On relie en glissant d'un point à l'autre, ou en touchant l'un puis l'autre.
    let depart = -1, glisse = false, choisi = -1;
    function choisir(i) {
      choisi = i;
      if (i < 0) { anneau.setAttribute('visibility', 'hidden'); return; }
      anneau.setAttribute('cx', nv.pts[i][0]); anneau.setAttribute('cy', nv.pts[i][1]);
      anneau.setAttribute('visibility', 'visible');
    }
    svg.onpointerdown = (ev) => {
      const [x, y] = Hub.position(svg, ev);
      const i = proche(x, y);
      if (i < 0) { choisir(-1); return; }
      if (choisi >= 0 && choisi !== i) { const a = choisi; choisir(-1); relier(a, i); return; }
      depart = i; glisse = false;
      choisir(i);
      svg.setPointerCapture(ev.pointerId);
    };
    svg.onpointermove = (ev) => {
      if (depart < 0) return;
      const [x, y] = Hub.position(svg, ev);
      const j = proche(x, y);
      if (j !== depart) glisse = true;
      const [ax, ay] = nv.pts[depart];
      const [bx, by] = j >= 0 && j !== depart ? nv.pts[j] : [x, y];
      apercu.setAttribute('x1', ax); apercu.setAttribute('y1', ay);
      apercu.setAttribute('x2', bx); apercu.setAttribute('y2', by);
      apercu.setAttribute('visibility', glisse ? 'visible' : 'hidden');
      apercu.setAttribute('opacity', j >= 0 && j !== depart && ReglesTriangles.refus(nv, traits, depart, j) ? 0.25 : 0.8);
    };
    const finir = (ev) => {
      if (depart < 0) return;
      apercu.setAttribute('visibility', 'hidden');
      const a = depart;
      depart = -1;
      if (!glisse || ev.type === 'pointercancel') return;
      const [x, y] = Hub.position(svg, ev);
      const j = proche(x, y);
      choisir(-1);
      if (j >= 0 && j !== a) relier(a, j);
    };
    svg.onpointerup = finir;
    svg.onpointercancel = finir;

    afficher();
    ui.message(`Forme ${niv.objectif} triangle${niv.objectif > 1 ? 's' : ''} en ${niv.traits} traits.`);
    return { annuler };
  }

  const regle = `<p>Glisse d’un point à un autre (ou touche-les l’un après l’autre) pour tracer un trait.</p>
    <ul>
      <li>Les traits ne se croisent jamais et ne traversent pas les murs.</li>
      <li>Trois points reliés entre eux forment un <strong>triangle</strong>, s’il n’y a aucun point dedans.</li>
      <li>Forme le nombre de triangles demandé sans dépasser le nombre de traits.</li>
    </ul>
    <p style="margin-top:8px;color:var(--encre-douce)">Astuce : un point entouré par d’autres rapporte plus de triangles par trait.</p>`;

  const illustration = `<svg viewBox="0 0 92 92" aria-hidden="true">
    <polygon points="18,70 46,18 50,58" fill="var(--accent-pale)"/>
    <polygon points="46,18 50,58 76,62" fill="var(--accent-pale)"/>
    <g stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" fill="none">
      <path d="M18 70L46 18L76 62M18 70L50 58L76 62M46 18L50 58"/>
    </g>
    <path d="M60 24L82 30" stroke="var(--mur)" stroke-width="5" stroke-linecap="round"/>
    <g fill="var(--encre)"><circle cx="18" cy="70" r="3.6"/><circle cx="46" cy="18" r="3.6"/><circle cx="50" cy="58" r="3.6"/><circle cx="76" cy="62" r="3.6"/><circle cx="24" cy="30" r="3.6"/></g>
  </svg>`;

  Hub.enregistrer('triangles', {
    titre: 'Triangles',
    accroche: 'Relie les points sans croiser, et fais le plus de triangles possible.',
    regle,
    illustration,
    niveaux: Niveaux.triangles,
    demarrer,
  });
})();
