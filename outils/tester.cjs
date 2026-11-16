// Joue chaque niveau des trois jeux dans un vrai navigateur, au doigt simulé,
// avec la solution trouvée par le générateur, et vérifie que la victoire s'affiche.
// Lancer depuis la racine du dépôt : node outils/tester.cjs
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const RC = require('../js/regles-carres.js');
const RP = require('../js/regles-ponts.js');

const racine = path.join(__dirname, '..');
const lire = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const charger = (nom) => { const self = {}; new Function('self', fs.readFileSync(path.join(racine, 'js', `niveaux-${nom}.js`), 'utf8'))(self); return self.Niveaux[nom]; };

const serveur = http.createServer((req, res) => {
  const f = path.join(racine, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(racine) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type + '; charset=utf-8' });
  fs.createReadStream(f).pipe(res);
});

// Ordre complet des traits pour les Carrés : chaque trait payé, puis toutes les cases gratuites.
function sequenceCarres(niv, payes) {
  const p = RC.plateau(niv.c, niv.r, niv.trous);
  const traces = new Set(niv.traces), seq = [];
  const gratuits = () => { for (;;) { const l = [...p.lignes.keys()].find((x) => !traces.has(x) && RC.fermerait(p, traces, x).length); if (l === undefined) return; traces.add(l); seq.push(l); } };
  gratuits();
  for (const l of payes) { if (!traces.has(l)) { traces.add(l); seq.push(l); } gratuits(); }
  return seq.map((l) => p.bouts(l));
}

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://127.0.0.1:${serveur.address().port}/`;
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 400, height: 860 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });

  // Repère du plateau → pixels de l'écran.
  const ecran = (x, y) => page.evaluate(([x, y]) => {
    const svg = document.getElementById('plateau');
    const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
    const q = pt.matrixTransform(svg.getScreenCTM());
    return [q.x, q.y];
  }, [x, y]);
  const gagne = () => page.evaluate(() => !document.getElementById('victoire').hidden);
  const glisser = async (a, b) => {
    const [ax, ay] = await ecran(...a), [bx, by] = await ecran(...b);
    await page.mouse.move(ax, ay); await page.mouse.down();
    await page.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 3 });
    await page.mouse.move(bx, by, { steps: 3 }); await page.mouse.up();
  };

  let echecs = 0;
  async function niveau(cle, n, jouer) {
    await page.goto(base + '#' + cle + '-' + n);
    await page.waitForSelector('#vue-jeu:not([hidden])');
    // La progression est vidée avant chaque partie : le niveau doit s'ouvrir parce que
    // le précédent vient d'être réussi, comme pour un vrai joueur.
    await jouer();
    await page.waitForTimeout(600);
    const ok = await gagne();
    if (!ok) { echecs++; console.log(`ÉCHEC ${cle} ${n} : ${await page.textContent('#jeu-message')}`); }
    return ok;
  }

  await page.goto(base);
  await page.evaluate(() => localStorage.clear());

  const carres = charger('carres'), solC = lire('solutions-carres.json');
  for (let i = 0; i < carres.length; i++) {
    await niveau('carres', i + 1, async () => {
      for (const [[x1, y1], [x2, y2]] of sequenceCarres(carres[i], solC[i])) {
        if (await gagne()) break;
        const [x, y] = await ecran(((x1 + x2) / 2) * 10, ((y1 + y2) / 2) * 10);
        await page.mouse.click(x, y);
      }
    });
  }

  const tri = charger('triangles'), solT = lire('solutions-triangles.json');
  for (let i = 0; i < tri.length; i++) {
    await niveau('triangles', i + 1, async () => {
      for (const [a, b] of solT[i]) {
        if (await gagne()) break;
        await glisser(tri[i].pts[a], tri[i].pts[b]);
      }
    });
  }

  const ponts = charger('ponts'), solP = lire('solutions-ponts.json');
  for (let i = 0; i < ponts.length; i++) {
    await niveau('ponts', i + 1, async () => {
      const nv = ponts[i], ar = RP.aretes(nv.w, nv.h, nv.iles);
      for (let k = 0; k < ar.length; k++) {
        const A = nv.iles[ar[k].a], B = nv.iles[ar[k].b];
        for (let v = 0; v < solP[i][k]; v++) {
          // Un pont sur deux posé en touchant les deux îles, l'autre en glissant :
          // les deux gestes sont ainsi vérifiés.
          if (v === 0) await glisser([A[0] * 10, A[1] * 10], [B[0] * 10, B[1] * 10]);
          else {
            const [ax, ay] = await ecran(A[0] * 10, A[1] * 10), [bx, by] = await ecran(B[0] * 10, B[1] * 10);
            await page.mouse.click(ax, ay); await page.mouse.click(bx, by);
          }
        }
      }
    });
  }

  // Les niveaux restent ouverts après un rechargement, et l'accueil compte les réussites.
  await page.goto(base);
  const avancees = await page.$$eval('.avancee', (els) => els.map((e) => e.textContent.trim()));
  console.log('Accueil :', avancees.join(' | '));
  await page.screenshot({ path: path.join(process.argv[2] || __dirname, 'accueil.png') });

  console.log(erreurs.length ? 'Erreurs de page : ' + erreurs.join(' / ') : 'Aucune erreur de page.');
  console.log(echecs ? `${echecs} niveau(x) en échec.` : `Les ${carres.length + tri.length + ponts.length} niveaux se gagnent.`);
  await navigateur.close();
  serveur.close();
  process.exit(echecs || erreurs.length ? 1 : 0);
})();
