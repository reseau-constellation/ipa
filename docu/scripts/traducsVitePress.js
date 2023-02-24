const { languePrincipale, dossierTraductions } = require("./consts.js");
const path = require("path");
const fs = require("fs");

const obtTraductions = (lng) => {
  const fichierTraducsLangue = path.join(dossierTraductions, lng + ".json");
  return fs.existsSync(fichierTraducsLangue)
    ? JSON.parse(fs.readFileSync(fichierTraducsLangue))
    : {};
};
const ajouterLangueAuxLiens = (lng, schéma, adresse = "") => {
  if (Array.isArray(schéma)) {
    return Object.entries(schéma)
      .map(([i, x]) => {
        return ajouterLangueAuxLiens(lng, x, adresse + "." + String(i));
      })
      .flat();
  } else if (typeof schéma === "object") {
    return Object.fromEntries(
      Object.entries(schéma).map(([clef, valeur]) => {
        if (clef === "link" && valeur[0] === "/") {
          return [clef, "/" + lng + valeur];
        } else if (clef === "text") {
          const traductions = obtTraductions(lng);
          const clefTraduc = "panneau" + adresse + "." + clef;
          const traduc = traductions[clefTraduc];
          return [clef, traduc || valeur];
        } else {
          return [
            clef,
            ajouterLangueAuxLiens(lng, valeur, adresse + "." + clef),
          ];
        }
      })
    );
  } else {
    return schéma;
  }
};
const générerPaneau = (lng = languePrincipale) => {
  if (lng === languePrincipale) {
    return schémaPaneau;
  } else {
    const navCôté = ajouterLangueAuxLiens(lng, schémaPaneau);
    return navCôté;
  }
};

const extraireTexteDic = (schéma, adresse = "") => {
  if (Array.isArray(schéma)) {
    return Object.entries(schéma)
      .map(([i, x]) => extraireTexteDic(x, adresse + "." + String(i)))
      .flat();
  } else if (typeof schéma === "object") {
    return Object.entries(schéma)
      .map(([clef, valeur]) => {
        if (clef === "text" || (clef === "link" && valeur[0] !== "/")) {
          return { clef: adresse + "." + clef, valeur };
        } else {
          return extraireTexteDic(valeur, adresse + "." + clef);
        }
      })
      .flat();
  }
};

const générerDicTraducsPaneau = () => {
  return extraireTexteDic(schémaPaneau).filter((x) => !!x);
};

const générerTitre = (lng) => {
  if (lng === languePrincipale) {
    return titre;
  } else {
    const traductions = obtTraductions(lng);
    return traductions["titre"] || titre;
  }
};

const générerDicTraducsTitre = () => {
  return [{ clef: "titre", valeur: titre }];
};

const générerDicTraducsNav = () => {
  return extraireTexteDic(schémaNav).filter((x) => !!x);
};

function générerNav(lng) {
  if (lng === languePrincipale) {
    return schémaNav;
  } else {
    const navCôté = ajouterLangueAuxLiens(lng, schémaNav);
    return navCôté;
  }
}

const générerPiedDePage = (lng) => {
  if (lng === languePrincipale) {
    return schémaPiedDePage;
  } else {
    return ajouterLangueAuxLiens(lng, schémaPiedDePage);
  }
};

const générerDicTraducsPiedDePage = () => {
  return extraireTexteDic(schémaPiedDePage).filter((x) => !!x);
};

const générerLienÉditer = (lng) => {
  if (lng === languePrincipale) {
    return schémaLienÉditer;
  } else {
    return ajouterLangueAuxLiens(lng, schémaLienÉditer);
  }
};

const générerDicTraducsLienÉditer = () => {
  return extraireTexteDic(schémaLienÉditer).filter((x) => !!x);
};

const titre = "Constellation";
const schémaNav = [
  {
    text: "Guide",
    link: "/guide/introduction",
  },
  {
    text: "Appli",
    link: "https://réseau-constellation.ca",
  },
];
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
          { text: "Nuées", link: "/avancé/applications/nuées" },
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
const schémaPiedDePage = {
  message: "Disponible sous licence AGPL-3.0",
  copyright: "© 2021+ Contributeurs Constellation",
};
const schémaLienÉditer = {
  pattern:
    "https://github.com/reseau-constellation/ipa/edit/main/docu/src/:path",
  text: "Éditer sur GitHub",
};

module.exports = {
  générerPaneau,
  générerDicTraducsPaneau,
  générerTitre,
  générerDicTraducsTitre,
  générerDicTraducsNav,
  générerNav,
  générerPiedDePage,
  générerDicTraducsPiedDePage,
  générerLienÉditer,
  générerDicTraducsLienÉditer,
};
