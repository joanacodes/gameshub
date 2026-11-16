// Fabrique les niveaux des trois jeux et vérifie, pour chacun, qu'il a une solution.
// Lancer : node outils/generer.cjs
// Les niveaux sont tirés d'une graine fixe : relancer le script redonne les mêmes,
// sauf si on touche aux réglages ci-dessous.
const fs = require('fs');
const path = require('path');
const RC = require('../js/regles-carres.js');
const RT = require('../js/regles-triangles.js');
const RP = require('../js/regles-ponts.js');

function graine(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const melanger = (t, R) => { for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };

// ───────────────────────── Les Carrés ─────────────────────────
// Règle solo : chaque trait coûte 1 d'énergie, sauf s'il ferme une case.
// Fermer une case ne fait jamais perdre (un trait ajouté n'enlève rien), donc un
// bon joueur prend toujours les cases gratuites. Ce qui reste à décider, c'est
// quels traits payer : le résultat ne dépend que de cet ensemble, pas de l'ordre.
// On énumère donc tous les ensembles de e traits payés pour connaître l'optimum exact.
function moteurCarres(p, traces) {
  const lignes = [...p.lignes.keys()];
  const cases = p.cases;
  const indexCase = new Map(cases.map((b, i) => [b.id, i]));
  const L = Math.max(...lignes) + 1;
  // État : traits posés et côtés manquants par case. On l'étend en prenant
  // toutes les cases gratuites, en chaîne.
  function etendre(pose, manque, depart) {
    const file = depart.slice();
    while (file.length) {
      const l = file.pop();
      if (pose[l]) continue;
      pose[l] = 1;
      for (const b of p.lignes.get(l)) {
        const i = indexCase.get(b);
        manque[i]--;
        if (manque[i] === 1) for (const s of cases[i].cotes) if (!pose[s]) file.push(s);
      }
    }
  }
  const pose0 = new Uint8Array(L), manque0 = new Int8Array(cases.length).fill(4);
  etendre(pose0, manque0, traces);
  // Les cases à trois côtés au départ se ferment gratuitement.
  const offerts = [];
  cases.forEach((b, i) => { if (manque0[i] === 1) for (const s of b.cotes) if (!pose0[s]) offerts.push(s); });
  etendre(pose0, manque0, offerts);
  const libres = lignes.filter((l) => !pose0[l]);
  function jouer(payes) {
    const pose = pose0.slice(), manque = manque0.slice();
    for (const l of payes) etendre(pose, manque, [l]);
    let f = 0;
    for (const m of manque) if (m === 0) f++;
    return f;
  }
  return { libres, jouer, total: cases.length };
}

function optimumCarres(m, e) {
  const F = m.libres, n = F.length;
  let best = -1, ens = null;
  const idx = [];
  (function rec(debut, k) {
    if (k === e) {
      const ch = idx.map((i) => F[i]);
      const f = m.jouer(ch);
      if (f > best) { best = f; ens = ch; }
      return;
    }
    for (let i = debut; i <= n - (e - k); i++) { idx.push(i); rec(i + 1, k + 1); idx.pop(); if (best === m.total) return; }
  })(0, 0);
  return { best, ens };
}

// Ce que ferme en moyenne un joueur qui paie ses traits au hasard : l'écart avec
// l'optimum mesure ce que le niveau demande de réfléchir.
function moyenneNaive(m, e, R) {
  let total = 0;
  const N = 300;
  for (let k = 0; k < N; k++) {
    const ch = [];
    while (ch.length < e) { const l = m.libres[Math.floor(R() * m.libres.length)]; if (!ch.includes(l)) ch.push(l); }
    total += m.jouer(ch);
  }
  return total / N;
}

function connexe(cols, rows, trous) {
  const ok = [];
  for (let b = 0; b < cols * rows; b++) if (!trous.has(b)) ok.push(b);
  const vu = new Set([ok[0]]), pile = [ok[0]];
  while (pile.length) {
    const b = pile.pop(), r = Math.floor(b / cols), c = b % cols;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc, v = rr * cols + cc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && !trous.has(v) && !vu.has(v)) { vu.add(v); pile.push(v); }
    }
  }
  return vu.size === ok.length;
}

function niveauCarres(spec, R) {
  let choix = null;
  for (let essai = 0; essai < spec.essais; essai++) {
    const trous = new Set();
    while (trous.size < spec.trous) {
      const t = Math.floor(R() * spec.c * spec.r);
      trous.add(t);
      if (!connexe(spec.c, spec.r, trous)) trous.delete(t);
    }
    const p = RC.plateau(spec.c, spec.r, [...trous]);
    // Au plus deux côtés posés par case : une case à trois côtés serait un cadeau,
    // pas une décision. La densité règle la longueur des couloirs.
    const tr = new Set();
    const poses = new Map(p.cases.map((b) => [b.id, 0]));
    for (const l of melanger([...p.lignes.keys()], R)) {
      if (R() > spec.densite || p.lignes.get(l).some((b) => poses.get(b) >= 2)) continue;
      tr.add(l);
      for (const b of p.lignes.get(l)) poses.set(b, poses.get(b) + 1);
    }
    const traces = [...tr].sort((x, y) => x - y);
    const m = moteurCarres(p, traces);
    for (let e = spec.emin; e <= spec.emax; e++) {
      const o = optimumCarres(m, e);
      if (o.best >= m.total) break;
      if (o.best < 3) continue;
      const ecart = o.best - moyenneNaive(m, e, R);
      // À écart égal, plus d'énergie veut dire plus de décisions à enchaîner.
      const note = ecart / Math.sqrt(o.best) + 0.25 * e;
      if (!choix || note > choix.note) choix = { note, ecart, e, opt: o.best, total: m.total, solution: o.ens, niveau: { c: spec.c, r: spec.r, trous: [...trous].sort((x, y) => x - y), traces } };
    }
  }
  if (!choix) throw new Error('aucun niveau pour ' + JSON.stringify(spec));
  const objectif = choix.opt - spec.marge;
  return {
    niveau: { ...choix.niveau, energie: choix.e, objectif },
    solution: choix.solution,
    info: `${choix.total} cases, énergie ${choix.e}, optimum ${choix.opt}, objectif ${objectif}, hasard −${choix.ecart.toFixed(1)}`,
  };
}

const SPECS_CARRES = [
  { c: 2, r: 2, trous: 0, emax: 2, marge: 0 },
  { c: 3, r: 2, trous: 0, emax: 2 },
  { c: 3, r: 3, trous: 0, emax: 2 },
  { c: 3, r: 3, trous: 1, emax: 3 },
  { c: 4, r: 3, trous: 0, emax: 3 },
  { c: 4, r: 3, trous: 1, emax: 3 },
  { c: 4, r: 4, trous: 2, emax: 3 },
  { c: 4, r: 4, trous: 0, emax: 4 },
  { c: 5, r: 3, trous: 0, emax: 4 },
  { c: 5, r: 4, trous: 3, emax: 4 },
  { c: 4, r: 5, trous: 2, emax: 4 },
  { c: 5, r: 4, trous: 0, emax: 4 },
  { c: 5, r: 5, trous: 4, emax: 5 },
  { c: 5, r: 5, trous: 2, emax: 5 },
  { c: 6, r: 5, trous: 4, emax: 5 },
].map((s) => ({ essais: 10, emin: 1, densite: 0.85, marge: 0, ...s }));

// ───────────────────────── Triangles ─────────────────────────
function pointsTriangles(spec, R) {
  const dseg = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  for (;;) {
    // Les murs d'abord, les points ensuite autour : dans l'autre sens, un plateau
    // serré n'a plus la place d'accueillir un mur.
    const murs = [];
    for (let tours = 0; murs.length < spec.murs && tours < 2000; tours++) {
      const cx = 18 + R() * 64, cy = 18 + R() * 64, a = R() * Math.PI, L = 18 + R() * 12;
      const m = [cx - Math.cos(a) * L / 2, cy - Math.sin(a) * L / 2, cx + Math.cos(a) * L / 2, cy + Math.sin(a) * L / 2].map((v) => Math.round(v));
      const loin = murs.every((u) => Math.min(dseg([u[0], u[1]], [m[0], m[1]], [m[2], m[3]]), dseg([u[2], u[3]], [m[0], m[1]], [m[2], m[3]]), dseg([m[0], m[1]], [u[0], u[1]], [u[2], u[3]]), dseg([m[2], m[3]], [u[0], u[1]], [u[2], u[3]])) > 12);
      const croise = murs.some((u) => !RT.niveau([[u[0], u[1]], [u[2], u[3]]], [m]).permis[0][1]);
      if (loin && !croise) murs.push(m);
    }
    if (murs.length < spec.murs) continue;
    // Trois points presque alignés sont permis : le trait du milieu est simplement
    // refusé, et l'aperçu pâlit avant qu'on lâche. Les interdire rendait les grands
    // plateaux impossibles à remplir.
    const pts = [];
    for (let tours = 0; pts.length < spec.n && tours < 6000; tours++) {
      const p = [Math.round(8 + R() * 84), Math.round(8 + R() * 84)];
      if (!pts.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= spec.dmin)) continue;
      if (!murs.every((m) => dseg(p, [m[0], m[1]], [m[2], m[3]]) > 5)) continue;
      pts.push(p);
    }
    if (pts.length < spec.n) continue;
    return { pts, murs };
  }
}

function meilleurTriangles(nv, K, R) {
  const LARGEUR = nv.n > 10 ? 70 : 160;
  let faisceau = [{ traits: [], voisins: Array.from({ length: nv.n }, () => new Set()), tri: 0 }];
  for (let d = 0; d < K; d++) {
    const enfants = new Map();
    for (const s of faisceau) {
      for (let i = 0; i < nv.n; i++) for (let j = i + 1; j < nv.n; j++) {
        if (RT.refus(nv, s.traits, i, j)) continue;
        const traits = s.traits.concat([[i, j]]);
        const cle = traits.map(([a, b]) => a * 100 + b).sort((a, b) => a - b).join(',');
        if (enfants.has(cle)) continue;
        const gain = RT.nouveauxTriangles(nv, s.voisins, i, j).length;
        const voisins = s.voisins.map((v) => new Set(v));
        voisins[i].add(j); voisins[j].add(i);
        // Potentiel : les « V » ouverts qu'un seul trait refermerait en triangle.
        let pot = 0;
        for (let k = 0; k < nv.n; k++) {
          const vs = [...voisins[k]];
          for (let x = 0; x < vs.length; x++) for (let y = x + 1; y < vs.length; y++) {
            if (voisins[vs[x]].has(vs[y])) continue;
            if (nv.vide(vs[x], vs[y], k) && !RT.refus(nv, traits, vs[x], vs[y])) pot++;
          }
        }
        enfants.set(cle, { traits, voisins, tri: s.tri + gain, score: (s.tri + gain) * 1000 + pot * 10 + R() * 8 });
      }
    }
    faisceau = [...enfants.values()].sort((a, b) => b.score - a.score).slice(0, LARGEUR);
  }
  faisceau.sort((a, b) => b.tri - a.tri);
  return faisceau[0];
}

function niveauTriangles(spec, R) {
  let choix = null;
  for (let essai = 0; essai < 3; essai++) {
    const { pts, murs } = pointsTriangles(spec, R);
    const nv = RT.niveau(pts, murs);
    const best = meilleurTriangles(nv, spec.k, R);
    if (!choix || best.tri > choix.best.tri) choix = { pts, murs, best };
  }
  const objectif = Math.max(1, choix.best.tri - (spec.marge || 0));
  return {
    niveau: { pts: choix.pts, murs: choix.murs, traits: spec.k, objectif },
    solution: choix.best.traits,
    info: `meilleur trouvé ${choix.best.tri}, objectif ${objectif}`,
  };
}

const SPECS_TRIANGLES = [
  { n: 5, k: 5, murs: 0, marge: 1 },
  { n: 6, k: 6, murs: 0, marge: 1 },
  { n: 6, k: 7, murs: 0 },
  { n: 7, k: 8, murs: 0 },
  { n: 8, k: 8, murs: 1 },
  { n: 8, k: 9, murs: 1 },
  { n: 9, k: 10, murs: 1 },
  { n: 10, k: 10, murs: 2 },
  { n: 10, k: 11, murs: 2 },
  { n: 11, k: 12, murs: 2 },
  { n: 12, k: 12, murs: 2 },
  { n: 12, k: 13, murs: 3 },
  { n: 13, k: 14, murs: 3 },
  { n: 14, k: 15, murs: 3 },
  { n: 15, k: 16, murs: 4 },
].map((s) => ({ dmin: Math.round(50 / Math.sqrt(s.n)), ...s }));

// ───────────────────────── Les Ponts ─────────────────────────
// Compte les solutions (jusqu'à 2). Un niveau n'est gardé que s'il en a une seule :
// c'est ce qui permet de le résoudre par déduction plutôt qu'au hasard.
function compterPonts(iles, ar, budget) {
  const n = iles.length, m = ar.length;
  const val = new Int8Array(m).fill(-1);
  const reste = iles.map((il) => il[2]);
  const deIle = iles.map(() => []);
  ar.forEach((e, i) => { deIle[e.a].push(i); deIle[e.b].push(i); });
  let noeuds = 0, sol = 0, premiere = null;
  const maxPossible = (i) => {
    const e = ar[i];
    for (const j of e.croise) if (val[j] > 0) return 0;
    return Math.max(0, Math.min(2, reste[e.a], reste[e.b]));
  };
  const capacite = (k) => deIle[k].reduce((s, i) => s + (val[i] < 0 ? maxPossible(i) : 0), 0);
  function rec() {
    if (++noeuds > budget) throw new Error('budget');
    let ile = -1, jeu = Infinity;
    for (let k = 0; k < n; k++) {
      if (reste[k] < 0) return;
      const cap = capacite(k);
      if (cap < reste[k]) return;
      if (reste[k] > 0 && cap - reste[k] < jeu) { jeu = cap - reste[k]; ile = k; }
    }
    if (ile < 0) {
      const v = Array.from(val, (x) => Math.max(0, x));
      if (RP.connexe(n, ar, v)) { sol++; if (!premiere) premiere = v; }
      return;
    }
    const e = deIle[ile].find((i) => val[i] < 0 && maxPossible(i) > 0);
    const haut = maxPossible(e);
    for (let v = haut; v >= 0 && sol < 2; v--) {
      val[e] = v; reste[ar[e].a] -= v; reste[ar[e].b] -= v;
      rec();
      val[e] = -1; reste[ar[e].a] += v; reste[ar[e].b] += v;
    }
  }
  rec();
  return { sol, premiere, noeuds };
}

function niveauPonts(spec, R) {
  const { w, h, n } = spec;
  for (let essai = 0; essai < 4000; essai++) {
    const iles = [];
    const occupe = new Map();
    const ponts = [];
    const x0 = Math.floor(R() * w), y0 = Math.floor(R() * h);
    iles.push([x0, y0]); occupe.set(x0 + ',' + y0, 'i');
    const portee = Math.max(3, Math.ceil(Math.max(w, h) / 2));
    for (let t = 0; t < 3000 && iles.length < n; t++) {
      const a = Math.floor(R() * iles.length);
      const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(R() * 4)];
      const d = 2 + Math.floor(R() * (portee - 1));
      const tx = iles[a][0] + dx * d, ty = iles[a][1] + dy * d;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h || occupe.has(tx + ',' + ty)) continue;
      let libre = true;
      for (let s = 1; s < d; s++) if (occupe.has(iles[a][0] + dx * s + ',' + (iles[a][1] + dy * s))) libre = false;
      // Deux îles collées se lisent mal sur un téléphone.
      for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (occupe.get(tx + ex + ',' + (ty + ey)) === 'i') libre = false;
      if (!libre) continue;
      for (let s = 1; s < d; s++) occupe.set(iles[a][0] + dx * s + ',' + (iles[a][1] + dy * s), 'p');
      occupe.set(tx + ',' + ty, 'i');
      iles.push([tx, ty]);
      ponts.push([a, iles.length - 1, R() < spec.doubles ? 2 : 1]);
    }
    if (iles.length < n) continue;
    let ar = RP.aretes(w, h, iles);
    const valeur = (e) => { const p = ponts.find(([a, b]) => (a === e.a && b === e.b) || (a === e.b && b === e.a)); return p ? p[2] : 0; };
    // Quelques ponts de plus ferment des boucles : sinon le réseau est un arbre,
    // trop facile à deviner.
    for (const e of melanger(ar.slice(), R)) {
      if (valeur(e) || R() > spec.boucles) continue;
      let libre = true;
      for (let x = e.x1, y = e.y1; ; ) {
        if (e.horiz) x++; else y++;
        if (x === e.x2 && y === e.y2) break;
        if (occupe.has(x + ',' + y)) { libre = false; break; }
      }
      if (!libre) continue;
      for (let x = e.x1, y = e.y1; ; ) {
        if (e.horiz) x++; else y++;
        if (x === e.x2 && y === e.y2) break;
        occupe.set(x + ',' + y, 'p');
      }
      ponts.push([e.a, e.b, R() < spec.doubles ? 2 : 1]);
    }
    const val = ar.map(valeur);
    const c = RP.comptes(iles, ar, val);
    const avecNombres = iles.map((il, i) => [il[0], il[1], c[i]]);
    if (!RP.resolu(avecNombres, ar, val)) throw new Error('génération incohérente');
    let r;
    try { r = compterPonts(avecNombres, ar, 400000); } catch { continue; }
    if (r.sol !== 1) continue;
    return { niveau: { w, h, iles: avecNombres }, solution: val, info: `${n} îles, ${r.noeuds} nœuds, essai ${essai}` };
  }
  throw new Error('aucun niveau unique trouvé pour ' + JSON.stringify(spec));
}

const SPECS_PONTS = [
  { w: 5, h: 5, n: 5 },
  { w: 5, h: 5, n: 6 },
  { w: 6, h: 6, n: 7 },
  { w: 6, h: 6, n: 8 },
  { w: 7, h: 7, n: 9 },
  { w: 7, h: 7, n: 10 },
  { w: 7, h: 7, n: 11 },
  { w: 8, h: 8, n: 12 },
  { w: 8, h: 8, n: 13 },
  { w: 8, h: 8, n: 14 },
  { w: 9, h: 9, n: 15 },
  { w: 9, h: 9, n: 16 },
  { w: 9, h: 9, n: 17 },
  { w: 9, h: 9, n: 18 },
  { w: 9, h: 9, n: 20 },
].map((s, i) => ({ doubles: 0.35, boucles: 0.25 + i * 0.02, ...s }));

// ───────────────────────── Écriture ─────────────────────────
function produire(nom, specs, fabrique, seed) {
  const R = graine(seed);
  const niveaux = [], solutions = [];
  specs.forEach((s, i) => {
    const t = Date.now();
    const r = fabrique(s, R);
    niveaux.push(r.niveau); solutions.push(r.solution);
    console.log(`${nom} ${i + 1}: ${r.info} (${Date.now() - t} ms)`);
  });
  const js = `// Fichier produit par outils/generer.cjs — ne pas modifier à la main.\nself.Niveaux = self.Niveaux || {};\nself.Niveaux.${nom} = ${JSON.stringify(niveaux)};\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'js', `niveaux-${nom}.js`), js);
  return solutions;
}

const quoi = process.argv[2];
// Les solutions servent au test de bout en bout (outils/tester.cjs), pas au jeu.
const ecrire = (nom, sol) => fs.writeFileSync(path.join(__dirname, `solutions-${nom}.json`), JSON.stringify(sol));
if (!quoi || quoi === 'carres') ecrire('carres', produire('carres', SPECS_CARRES, niveauCarres, 11));
if (!quoi || quoi === 'triangles') ecrire('triangles', produire('triangles', SPECS_TRIANGLES, niveauTriangles, 22));
if (!quoi || quoi === 'ponts') ecrire('ponts', produire('ponts', SPECS_PONTS, niveauPonts, 33));
