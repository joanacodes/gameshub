// Règles des Ponts, partagées entre le navigateur et le générateur.
(function (racine, fabrique) {
  const m = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else racine.ReglesPonts = m;
})(typeof self !== 'undefined' ? self : this, function () {
  // Un pont ne relie que deux îles voisines en ligne droite, sans île entre elles.
  function aretes(w, h, iles) {
    const grille = new Map(iles.map((il, i) => [il[0] + ',' + il[1], i]));
    const res = [];
    iles.forEach(([x, y], a) => {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        for (let cx = x + dx, cy = y + dy; cx < w && cy < h; cx += dx, cy += dy) {
          const b = grille.get(cx + ',' + cy);
          if (b !== undefined) { res.push({ a, b, horiz: dx === 1 }); break; }
        }
      }
    });
    res.forEach((e) => {
      const A = iles[e.a], B = iles[e.b];
      e.x1 = Math.min(A[0], B[0]); e.x2 = Math.max(A[0], B[0]);
      e.y1 = Math.min(A[1], B[1]); e.y2 = Math.max(A[1], B[1]);
    });
    res.forEach((e, i) => {
      e.croise = [];
      res.forEach((f, j) => {
        if (e.horiz === f.horiz) return;
        const H = e.horiz ? e : f, V = e.horiz ? f : e;
        if (V.x1 > H.x1 && V.x1 < H.x2 && H.y1 > V.y1 && H.y1 < V.y2) e.croise.push(j);
      });
    });
    return res;
  }

  function comptes(iles, ar, val) {
    const c = new Array(iles.length).fill(0);
    ar.forEach((e, i) => { c[e.a] += val[i]; c[e.b] += val[i]; });
    return c;
  }

  function connexe(n, ar, val) {
    const vu = new Array(n).fill(false);
    const pile = [0]; vu[0] = true; let nb = 1;
    while (pile.length) {
      const u = pile.pop();
      ar.forEach((e, i) => {
        if (!val[i]) return;
        const v = e.a === u ? e.b : e.b === u ? e.a : -1;
        if (v >= 0 && !vu[v]) { vu[v] = true; nb++; pile.push(v); }
      });
    }
    return nb === n;
  }

  function resolu(iles, ar, val) {
    const c = comptes(iles, ar, val);
    return iles.every((il, i) => c[i] === il[2]) && connexe(iles.length, ar, val);
  }

  return { aretes, comptes, connexe, resolu };
});
