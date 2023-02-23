const marked = require("marked");
const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");
const {
  générerDicTraducsPaneau,
  générerDicTraducsNav,
  générerDicTraducsTitre,
  générerDicTraducsPiedDePage,
  générerDicTraducsLienÉditer,
} = require("./traducsVitePress.js");
const xml2js = require("xml2js");

const {
  languePrincipale,
  langues,
  dossierTraductions,
  racineProjet,
} = require("./consts.js");

const walk = function* (directoryName, exts) {
  const fichiers = fs.readdirSync(directoryName);
  for (const fichier of fichiers) {
    const f = fs.statSync(directoryName + path.sep + fichier);
    if (f.isDirectory()) {
      for (const x of walk(directoryName + path.sep + fichier, exts)) {
        yield x;
      }
    } else {
      const ext = fichier.split(".").pop();
      // Pour éviter d'inclure les fichiers déjà traduits...VitePresse à une drôle de structure de fichiers !
      // Mais je n'y suis pour rien.
      const dossierDeuxièmeNiveau = directoryName.split(path.sep)[1];
      if (exts.includes(ext) && !langues.includes(dossierDeuxièmeNiveau)) {
        yield path.join(directoryName, fichier);
      }
    }
  }
};

const extraireTraductiblesDeMd = (md) => {
  const lexé = marked.lexer(md);
  return lexé.filter((l) => l.type !== "space").map((l) => l.raw);
};

const extraireTraductiblesDeSvg = async (svg) => {
  const lexé = await xml2js.Parser().parseStringPromise(svg);
  return lexé.svg.text?.map((t) => t._) || [];
};

const empreinte = (x) => {
  return crypto.createHash("md5").update(x).digest("hex");
};

const calculerClef = (fichier, texte) => {
  return fichier + "." + empreinte(texte);
};

const extraireTraductiblesProjet = async () => {
  const dicTraducs = {};
  for (const fichier of walk(racineProjet, ["md", "svg"])) {
    const ext = fichier.split(".").pop();
    let traductiblesFichier = [];
    switch (ext) {
      case "md":
        traductiblesFichier = extraireTraductiblesDeMd(
          fs.readFileSync(fichier).toString()
        );
        break;
      case "svg":
        traductiblesFichier = await extraireTraductiblesDeSvg(
          fs.readFileSync(fichier).toString()
        );
        break;
      default:
        continue;
    }

    for (const traductible of traductiblesFichier) {
      const clef = calculerClef(fichier, traductible);
      dicTraducs[clef] = traductible;
    }
  }

  for (const x of générerDicTraducsPaneau()) {
    dicTraducs["panneau" + x.clef] = x.valeur;
  }
  for (const x of générerDicTraducsTitre()) {
    dicTraducs[x.clef] = x.valeur;
  }
  for (const x of générerDicTraducsNav()) {
    dicTraducs["nav" + x.clef] = x.valeur;
  }
  for (const x of générerDicTraducsPiedDePage()) {
    dicTraducs["pied" + x.clef] = x.valeur;
  }
  for (const x of générerDicTraducsLienÉditer()) {
    dicTraducs["liensÉditer" + x.clef] = x.valeur;
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

const compilerTraductions = async () => {
  for (const langue of langues) {
    const dossierSourcesTraduites = path.join(racineProjet, langue);
    if (fs.existsSync(dossierSourcesTraduites))
      fs.rmdirSync(dossierSourcesTraduites, { recursive: true });
    fs.mkdirSync(dossierSourcesTraduites, { recursive: true });
    const fichierTraducsLangue = path.join(
      dossierTraductions,
      langue + ".json"
    );
    const traductions = fs.existsSync(fichierTraducsLangue)
      ? JSON.parse(fs.readFileSync(fichierTraducsLangue))
      : {};

    for (const fichier of walk(racineProjet, ["md", "svg"])) {
      const texteFinal = [];
      const texte = fs.readFileSync(fichier).toString();
      const ext = fichier.split(".").pop();

      switch (ext) {
        case "md": {
          const lexée = marked.lexer(texte);
          for (const élément of lexée) {
            const clef = calculerClef(fichier, élément.raw);
            const traduction = traductions[clef];
            texteFinal.push(traduction || élément.raw);
          }
          break;
        }
        case "svg": {
          const lexé = await xml2js.Parser().parseStringPromise(texte);
          for (const t of lexé.svg?.text || []) {
            const clef = calculerClef(fichier, t._);
            t._ = traductions[clef] || t._;
          }
          const reconstitué = new xml2js.Builder().buildObject(lexé);
          texteFinal.push(reconstitué);
          break;
        }
        default:
          throw new Error("Extention non reconnue : " + ext);
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

const ajusterGitIgnore = () => {
  const lignes = fs.readFileSync(`.gitignore`, "utf-8").split("\n");
  const déjàLà = [];
  for (const l of lignes) {
    const existe = langues.find((lng) => l === `${racineProjet}/${lng}`);
    if (existe) déjàLà.push(existe);
  }
  let modifié = false;
  for (const lng of langues.filter((lng) => !déjàLà.includes(lng))) {
    lignes.push(`${racineProjet}/${lng}`);
    modifié = true;
  }
  if (modifié) lignes.push("");

  fs.writeFileSync(`.gitignore`, lignes.join("\n"));
};

module.exports = {
  languePrincipale,
  langues,
  extraireTraductiblesProjet,
  compilerTraductions,
  ajusterGitIgnore,
};
