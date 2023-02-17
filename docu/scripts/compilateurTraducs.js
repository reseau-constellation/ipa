const marked = require("marked");
const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");
const générerDicTraducsPaneau =
  require("./traducsVitePress.js").générerDicTraducsPaneau;

const {
    languePrincipale, 
    langues ,
    dossierTraductions,
    racineProjet,
}= require("./consts.js");

const walk = function* (directoryName) {
  const fichiers = fs.readdirSync(directoryName);
  for (const fichier of fichiers) {
    const f = fs.statSync(directoryName + path.sep + fichier);
    if (f.isDirectory()) {
      for (const x of walk(directoryName + path.sep + fichier)) {
        yield x;
      }
    } else {
      const ext = fichier.split(".").pop();
      // Pour éviter d'inclure les fichiers déjà traduits...VitePresse à une drôle de structure de fichiers !
      // Mais je n'y suis pour rien.
      const dossierDeuxièmeNiveau = directoryName.split(path.sep)[1];
      if (ext === "md" && !langues.includes(dossierDeuxièmeNiveau)) {
        yield path.join(directoryName, fichier);
      }
    }
  }
};

const extraireTraductiblesDeMd = (md) => {
  const lexé = marked.lexer(md);
  return lexé.filter((l) => l.type !== "space").map((l) => l.raw);
};

const empreinte = (x) => {
  return crypto.createHash("md5").update(x).digest("hex");
};

const calculerClef = (fichier, texte) => {
  return fichier + "." + empreinte(texte);
};

const extraireTraductiblesProjet = () => {
  const dicTraducs = {};
  for (const fichier of walk(racineProjet)) {
    const texte = fs.readFileSync(fichier).toString();
    const traductiblesFichier = extraireTraductiblesDeMd(texte);
    for (const traductible of traductiblesFichier) {
      const clef = calculerClef(fichier, traductible);
      dicTraducs[clef] = traductible;
    }
  }

  for (const x of générerDicTraducsPaneau()) {
    dicTraducs["panneau" + x.clef] = x.valeur;
  }
  mettreFichiersTraducsÀJour(dicTraducs);
};

const mettreFichiersTraducsÀJour = (dicTraducs) => {
  if (
    !fs.existsSync(dossierTraductions) ||
    !fs.statSync(dossierTraductions).isDirectory()
  ) {
    fs.mkdirSync(dossierTraductions, { recursive: true });
  }
  const fichierTraducs = path.join(
    dossierTraductions,
    languePrincipale + ".json"
  );
  fs.writeFileSync(fichierTraducs, JSON.stringify(dicTraducs, null, 4));

  for (const langue of langues) {
    const fichierTraducsLangue = path.join(
      dossierTraductions,
      langue + ".json"
    );
    const traducsLangue = fs.existsSync(fichierTraducsLangue)
      ? JSON.parse(fs.readFileSync(fichierTraducsLangue))
      : {};
    fs.writeFileSync(
      fichierTraducsLangue,
      JSON.stringify(traducsLangue, null, 4)
    );
  }
};

const compilerTraductions = () => {
  for (const langue of langues) {
    const dossierSourcesTraduites = path.join(racineProjet, langue);
    if (!fs.existsSync(dossierSourcesTraduites)) {
      fs.mkdirSync(dossierSourcesTraduites, { recursive: true });
    }
    const fichierTraducsLangue = path.join(
      dossierTraductions,
      langue + ".json"
    );
    const traductions = fs.existsSync(fichierTraducsLangue)
      ? JSON.parse(fs.readFileSync(fichierTraducsLangue))
      : {};

    for (const fichier of walk(racineProjet)) {
      const texteFinal = [];
      const texte = fs.readFileSync(fichier).toString();
      const lexée = marked.lexer(texte);
      for (const élément of lexée) {
        const clef = calculerClef(fichier, élément.raw);
        const traduction = traductions[clef];
        texteFinal.push(traduction || élément.raw);
      }
      const composantesAdresseFichier = fichier.split(path.sep);
      const fichierSourceTraduite = path.join(
        composantesAdresseFichier[0],
        langue,
        ...composantesAdresseFichier.slice(1)
      );
      const dossierSourceTraduite = fichierSourceTraduite
        .split(path.sep)
        .slice(0, -1)
        .join(path.sep);
      if (!fs.existsSync(dossierSourceTraduite))
        fs.mkdirSync(dossierSourceTraduite, { recursive: true });
      fs.writeFileSync(fichierSourceTraduite, texteFinal.join(""));
    }
  }
};
module.exports = {
  languePrincipale,
  langues,
  extraireTraductiblesProjet,
  compilerTraductions,
};
