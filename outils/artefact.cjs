// Rassemble le site en une seule page autonome (styles et scripts en ligne),
// pour la publier ou l'envoyer sans le reste du dépôt.
// Lancer : node outils/artefact.cjs chemin/de/sortie.html
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const sortie = process.argv[2] || path.join(racine, 'points-lies.html');
let html = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');

html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${fs.readFileSync(path.join(racine, 'style.css'), 'utf8')}</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(racine, f), 'utf8')}</script>`);
// La page publiée reçoit son propre squelette (doctype, head, body) : on n'en garde que le contenu.
html = html
  .replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<\/head>\s*<body>\s*/i, '')
  .replace(/<\/body>\s*<\/html>\s*$/i, '');

fs.writeFileSync(sortie, html);
console.log(`${sortie} (${(html.length / 1024).toFixed(0)} Ko)`);
