// Règles des Carrés, partagées entre le navigateur et le générateur de niveaux
// pour que le niveau joué soit exactement celui qui a été vérifié.
(function (racine, fabrique) {
  const m = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else racine.ReglesCarres = m;
})(typeof self !== 'undefined' ? self : this, function () {
  // Les traits sont numérotés : d'abord les horizontaux, ligne par ligne,
  // puis les verticaux. Un niveau se décrit ainsi par une simple liste de nombres.
  function plateau(cols, rows, trous) {
    const H = (rows + 1) * cols;
    const trou = new Set(trous || []);
    const cases = [];
    const lignes = new Map();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = r * cols + c;
        if (trou.has(id)) continue;
        const cotes = [r * cols + c, (r + 1) * cols + c, H + r * (cols + 1) + c, H + r * (cols + 1) + c + 1];
        cases.push({ id, r, c, cotes });
        for (const l of cotes) {
          if (!lignes.has(l)) lignes.set(l, []);
          lignes.get(l).push(id);
        }
      }
    }
    function bouts(l) {
      if (l < H) {
        const r = Math.floor(l / cols), c = l % cols;
        return [[c, r], [c + 1, r]];
      }
      const k = l - H, r = Math.floor(k / (cols + 1)), c = k % (cols + 1);
      return [[c, r], [c, r + 1]];
    }
    return { cols, rows, H, cases, caseParId: new Map(cases.map((x) => [x.id, x])), lignes, bouts };
  }

  // Cases que le trait l fermerait, sachant les traits déjà tracés.
  function fermerait(p, traces, l) {
    return p.lignes.get(l).filter((b) => p.caseParId.get(b).cotes.every((s) => s === l || traces.has(s)));
  }

  return { plateau, fermerait };
});
