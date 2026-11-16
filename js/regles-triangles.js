// Géométrie des Triangles, partagée entre le navigateur et le générateur.
(function (racine, fabrique) {
  const m = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else racine.ReglesTriangles = m;
})(typeof self !== 'undefined' ? self : this, function () {
  const orient = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);

  function distSeg(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }

  // Croisement strict : deux traits qui partagent un point ne se croisent pas.
  const croiseStrict = (a, b, c, d) => orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
  // Un mur se touche aussi par la tangente : effleurer son bout reste interdit.
  const toucheMur = (a, b, c, d) => orient(a, b, c) * orient(a, b, d) <= 0 && orient(c, d, a) * orient(c, d, b) <= 0;

  function dedans(p, a, b, c) {
    const d1 = orient(a, b, p), d2 = orient(b, c, p), d3 = orient(c, a, p);
    return (d1 > 0 && d2 > 0 && d3 > 0) || (d1 < 0 && d2 < 0 && d3 < 0);
  }

  function niveau(pts, murs) {
    murs = murs || [];
    const n = pts.length;
    // Ce qui ne dépend pas des coups joués est calculé une fois.
    const permis = Array.from({ length: n }, () => new Array(n).fill(false));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ok = true;
        // Un trait qui passe à moins de 3 d'un point semble le traverser à l'écran (point de
        // rayon 2,4) : il est refusé, pour que ce qu'on voit et la règle disent la même chose.
        for (let k = 0; k < n && ok; k++) if (k !== i && k !== j && distSeg(pts[k], pts[i], pts[j]) < 3) ok = false;
        for (const m of murs) if (ok && toucheMur(pts[i], pts[j], [m[0], m[1]], [m[2], m[3]])) ok = false;
        permis[i][j] = permis[j][i] = ok;
      }
    }
    const videCache = new Map();
    function vide(i, j, k) {
      const cle = [i, j, k].sort((x, y) => x - y).join(',');
      if (!videCache.has(cle)) {
        let v = true;
        for (let q = 0; q < n && v; q++) if (q !== i && q !== j && q !== k && dedans(pts[q], pts[i], pts[j], pts[k])) v = false;
        videCache.set(cle, v);
      }
      return videCache.get(cle);
    }
    return { pts, murs, n, permis, vide };
  }

  // Raison du refus, ou null si le trait est possible.
  function refus(nv, traits, i, j) {
    if (i === j) return 'même point';
    if (!nv.permis[i][j]) return nv.murs.length ? 'un mur ou un point barre le passage' : 'un point barre le passage';
    for (const [a, b] of traits) {
      if ((a === i && b === j) || (a === j && b === i)) return 'déjà tracé';
      if (a === i || a === j || b === i || b === j) continue;
      if (croiseStrict(nv.pts[i], nv.pts[j], nv.pts[a], nv.pts[b])) return 'les traits ne se croisent pas';
    }
    return null;
  }

  // Un triangle ne compte que s'il est vide : sinon on pourrait le « remplir »
  // avec un point qu'il recouvre, et le décompte n'aurait plus de sens.
  function nouveauxTriangles(nv, voisins, i, j) {
    const res = [];
    for (const k of voisins[i]) if (voisins[j].has(k) && nv.vide(i, j, k)) res.push([i, j, k]);
    return res;
  }

  return { niveau, refus, nouveauxTriangles };
});
