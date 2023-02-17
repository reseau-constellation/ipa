const {languePrincipale, dossierTraductions} = require("./consts.js");
const path = require("path");
const fs = require("fs");

const générerPaneau = (lng = languePrincipale) => {
  const ajouterLangueAuxLiens = (lng, schéma, adresse="") => {
    if (Array.isArray(schéma)) {
      return Object.entries(schéma).map(([i, x]) => {
        return ajouterLangueAuxLiens(lng, x, adresse+"."+String(i))}).flat();
    } else if (typeof schéma === "object") {
      return Object.fromEntries(
        Object.entries(schéma).map(([clef, valeur]) => {
          if (clef === "link") { 
            return [clef, "/" + lng + valeur];
          } else if (clef === "text") {
            const fichierTraducsLangue = path.join(
                dossierTraductions,
                lng + ".json" 
              );
            const traductions = fs.existsSync(fichierTraducsLangue)
                ? JSON.parse(fs.readFileSync(fichierTraducsLangue))
            : {};
            const clefTraduc = "panneau" + adresse + "." + clef;
            const traduc = traductions[clefTraduc]
            return [clef, traduc || valeur];
          } else {
            return [clef, ajouterLangueAuxLiens(lng, valeur, adresse + "." + clef)];
          }
        })
      );
    } else {
      return schéma;
    }
  };
  
  if (lng === languePrincipale) {
      return schémaPaneau;
    } else {
      const navCôté = ajouterLangueAuxLiens(lng, schémaPaneau);
      return navCôté
  }
};

const générerDicTraducsPaneau = () => {
  const extraireTextePaneau = (schéma, adresse = "") => {
    if (Array.isArray(schéma)) {
      return Object.entries(schéma)
        .map(([i, x]) => extraireTextePaneau(x, adresse + "." + String(i)))
        .flat();
    } else if (typeof schéma === "object") {
      return Object.entries(schéma)
        .map(([clef, valeur]) => {
          if (clef === "text") {
            return { clef: adresse + "." + clef, valeur };
          } else {
            return extraireTextePaneau(valeur, adresse + "." + clef);
          }
        })
        .flat();
    }
  };
  return extraireTextePaneau(schémaPaneau).filter((x) => !!x);
};

const schémaPaneau = [
  {
    text: "Guide",
    items: [
      { text: "Introduction", link: "/guide/introduction" },
      { text: "Installation", link: "/guide/installation" },
      { text: "Pair à pair", link: "/guide/pairÀPair" },
      { text: "Concepts", link: "/guide/concepts" },
    ],
  },
  {
    text: "Exemples",
    items: [
      { text: "Science citoyenne", link: "/exemples/scienceCitoyenne" },
      { text: "Diffusion de données", link: "/exemples/diffusion" },
    ],
  },
  {
    text: "Avancé",
    items: [
      {
        text: "Autres langages",
        items: [
          {
            text: "Introduction",
            link: "/avancé/autresLangages/introduction",
          },
          { text: "Python", link: "/avancé/autresLangages/python" },
          { text: "Julia", link: "/avancé/autresLangages/julia" },
        ],
      },
      {
        text: "Développement d'applis",
        items: [
          { text: "Introduction", link: "/avancé/applications/introduction" },
          { text: "Applis Internet", link: "/avancé/applications/internet" },
          { text: "Applis Électron", link: "/avancé/applications/électron" },
        ],
      },
      { text: "Mandataires", link: "/avancé/mandataires" },
      { text: "Configuration SFIP et Orbite", link: "/avancé/sfipEtOrbite" },
    ],
  },
  {
    text: "Documentation IPA",
    collapsible: true,
    items: [
      { text: "Introduction", link: "/ipa/introduction" },
      { text: "Client", link: "/ipa/client" },
      { text: "Profil", link: "/ipa/profil" },
      { text: "Variables", link: "/ipa/variables" },
      { text: "Mots-clefs", link: "/ipa/motsClefs" },
      { text: "Tableaux", link: "/ipa/tableaux" },
      { text: "Bases de données", link: "/ipa/bds" },
      { text: "Projets", link: "/ipa/projets" },
      { text: "Recherche", link: "/ipa/recherche" },
      { text: "Réseau", link: "/ipa/réseau" },
      { text: "Nuées", link: "/ipa/nuées" },
    ],
  },
];

module.exports = {
  générerPaneau,
  générerDicTraducsPaneau,
};
