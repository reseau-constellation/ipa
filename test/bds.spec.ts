import fs from "fs";
import path from "path";

import { isSet } from "lodash-es";

import {
  dossiers,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";

import { uneFois } from "@constl/utils-ipa";
import { isValidAddress } from "@orbitdb/core";

import { expect } from "aegir/chai";
import JSZip from "jszip";
import { isElectronMain, isNode } from "wherearewe";
import {
  TraducsNom,
  schémaFonctionOublier,
  schémaFonctionSuivi,
} from "@/types.js";
import { créerConstellation, type Constellation } from "@/index.js";
import { obtRessourceTest } from "./ressources/index.js";
import { obtenir } from "./utils/utils.js";
import type { règleBornes } from "@/valid.js";
import type {
  InfoCol,
  InfoColAvecCatégorie,
  élémentBdListeDonnées,
  élémentDonnées,
} from "@/tableaux.js";
import type {
  infoScore,
  infoTableauAvecId,
  schémaSpécificationBd,
} from "@/bds.js";
import type XLSX from "xlsx";

const { créerConstellationsTest } = utilsTestConstellation;

describe("BDs", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let constl: Constellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
      n: 1,
      créerConstellation,
    }));
    constl = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Création bds", function () {
    it("Création", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      expect(isValidAddress(idBd)).to.be.true();
    });
    it("Accès", async () => {
      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const permission = await obtenir(({ si }) =>
        constl.suivrePermissionÉcrire({
          id: idBd,
          f: si((x) => !!x),
        }),
      );
      expect(permission).to.be.true();
    });
  });

  describe("Mes BDs", () => {
    let idBd: string;
    let idNouvelleBd: string;

    let fOublierClients: () => Promise<void>;
    let clients: Constellation[];
    let constl: Constellation;

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
        n: 1,
        créerConstellation,
      }));
      constl = clients[0];
    });

    after(async () => {
      if (fOublierClients) await fOublierClients();
    });

    it("Une BD déjà créée est présente", async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const mesBds = await obtenir<string[]>(({ siDéfini }) =>
        constl.bds.suivreBds({
          f: siDéfini(),
        }),
      );
      expect(mesBds).to.be.an("array").and.to.contain(idBd);
    });

    it("On crée une autre BD sans l'ajouter", async () => {
      idNouvelleBd = await constl.bds.créerBd({
        licence: "ODbl-1_0",
      });
      await constl.bds.enleverDeMesBds({ idBd: idNouvelleBd });
      const mesBds = await obtenir<string[]>(({ si }) =>
        constl.bds.suivreBds({
          f: si((x) => x.length < 2),
        }),
      );
      expect(mesBds).to.be.an("array").and.not.contain(idNouvelleBd);
    });

    it("On peut l'ajouter ensuite à mes bds", async () => {
      await constl.bds.ajouterÀMesBds({ idBd: idNouvelleBd });
      const mesBds = await obtenir<string[]>(({ si }) =>
        constl.bds.suivreBds({
          f: si((x) => x.length > 1),
        }),
      );
      expect(mesBds)
        .to.be.an("array")
        .with.length(2)
        .to.have.members([idNouvelleBd, idBd]);
    });

    it("On peut aussi l'effacer", async () => {
      await constl.bds.effacerBd({ idBd: idNouvelleBd });
      const mesBds = await obtenir<string[]>(({ si }) =>
        constl.bds.suivreBds({
          f: si((x) => x.length < 2),
        }),
      );
      expect(mesBds).to.be.an("array").with.length(1).and.to.contain(idBd);
    });
  });

  describe("Noms", function () {
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("Pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsNom>(({ siDéfini }) =>
        constl.bds.suivreNomsBd({ idBd, f: siDéfini() }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("Ajouter un nom", async () => {
      await constl.bds.sauvegarderNomBd({
        idBd,
        langue: "fr",
        nom: "Alphabets",
      });
      const noms = await obtenir<TraducsNom>(({ si }) =>
        constl.bds.suivreNomsBd({
          idBd,
          f: si((n) => Object.keys(n).length > 0),
        }),
      );
      expect(noms.fr).to.equal("Alphabets");
    });

    it("Ajouter des noms", async () => {
      await constl.bds.sauvegarderNomsBd({
        idBd,
        noms: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const noms = await obtenir<TraducsNom>(({ si }) =>
        constl.bds.suivreNomsBd({
          idBd,
          f: si((n) => Object.keys(n).length > 2),
        }),
      );
      expect(noms).to.deep.equal({
        fr: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("Changer un nom", async () => {
      await constl.bds.sauvegarderNomBd({
        idBd,
        langue: "fr",
        nom: "Systèmes d'écriture",
      });
      const noms = await obtenir<TraducsNom>(({ si }) =>
        constl.bds.suivreNomsBd({
          idBd,
          f: si((n) => n["fr"] !== "Alphabets"),
        }),
      );

      expect(noms?.fr).to.equal("Systèmes d'écriture");
    });

    it("Effacer un nom", async () => {
      await constl.bds.effacerNomBd({ idBd, langue: "fr" });
      const noms = await obtenir<TraducsNom>(({ si }) =>
        constl.bds.suivreNomsBd({ idBd, f: si((n) => !n["fr"]) }),
      );
      expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("Descriptions", function () {
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("Aucune description pour commencer", async () => {
      const descrs = await obtenir<TraducsNom>(({ siDéfini }) =>
        constl.bds.suivreDescriptionsBd({ idBd, f: siDéfini() }),
      );
      expect(Object.keys(descrs).length).to.equal(0);
    });

    it("Ajouter une description", async () => {
      await constl.bds.sauvegarderDescriptionBd({
        idBd,
        langue: "fr",
        description: "Alphabets",
      });

      const descrs = await obtenir<TraducsNom>(({ si }) =>
        constl.bds.suivreDescriptionsBd({ idBd, f: si((x) => !!x["fr"]) }),
      );
      expect(descrs.fr).to.equal("Alphabets");
    });

    it("Ajouter des descriptions", async () => {
      await constl.bds.sauvegarderDescriptionsBd({
        idBd,
        descriptions: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });

      const descrs = await obtenir<TraducsNom>(({ si }) =>
        constl.bds.suivreDescriptionsBd({
          idBd,
          f: si((x) => Object.keys(x).length > 2),
        }),
      );
      expect(descrs).to.deep.equal({
        fr: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("Changer une description", async () => {
      await constl.bds.sauvegarderDescriptionBd({
        idBd,
        langue: "fr",
        description: "Systèmes d'écriture",
      });

      const descrs = await obtenir<TraducsNom>(({ si }) =>
        constl.bds.suivreDescriptionsBd({
          idBd,
          f: si((x) => x["fr"] !== "Alphabets"),
        }),
      );
      expect(descrs?.fr).to.equal("Systèmes d'écriture");
    });

    it("Effacer une description", async () => {
      await constl.bds.effacerDescriptionBd({ idBd, langue: "fr" });

      const descrs = await obtenir<TraducsNom>(({ si }) =>
        constl.bds.suivreDescriptionsBd({ idBd, f: si((x) => !x["fr"]) }),
      );
      expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

  describe("Mots-clefs", function () {
    let idMotClef: string;
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("Pas de mots-clefs pour commencer", async () => {
      const motsClefs = await obtenir<string[]>(({ siDéfini }) =>
        constl.bds.suivreMotsClefsBd({
          idBd,
          f: siDéfini(),
        }),
      );
      expect(motsClefs).to.be.an.empty("array");
    });
    it("Ajout d'un mot-clef", async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
      await constl.bds.ajouterMotsClefsBd({
        idBd,
        idsMotsClefs: idMotClef,
      });

      const motsClefs = await obtenir<string[]>(({ si }) =>
        constl.bds.suivreMotsClefsBd({
          idBd,
          f: si((x) => x.length > 0),
        }),
      );
      expect(Array.isArray(motsClefs)).to.be.true();
      expect(motsClefs.length).to.equal(1);
    });
    it("Effacer un mot-clef", async () => {
      await constl.bds.effacerMotClefBd({ idBd, idMotClef });

      const motsClefs = await obtenir<string[]>(({ siVide }) =>
        constl.bds.suivreMotsClefsBd({
          idBd,
          f: siVide(),
        }),
      );
      expect(motsClefs).to.be.an.empty("array");
    });
  });

  describe("Changer licence BD", function () {
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("Licence originale présente", async () => {
      const licence = await obtenir(({ siDéfini }) =>
        constl.bds.suivreLicenceBd({
          idBd,
          f: siDéfini(),
        }),
      );

      expect(licence).to.equal("ODbl-1_0");
    });

    it("Changement de licence", async () => {
      await constl.bds.changerLicenceBd({ idBd, licence: "ODC-BY-1_0" });

      const licence = await await obtenir(({ si }) =>
        constl.bds.suivreLicenceBd({
          idBd,
          f: si((l) => l !== "ODbl-1_0"),
        }),
      );
      expect(licence).to.equal("ODC-BY-1_0");
    });
  });

  describe("Statut BD", function () {
    it.skip("À faire");
  });

  describe("Tableaux", function () {
    let idTableau: string;
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("Pas de tableaux pour commencer", async () => {
      const tableaux = await obtenir<infoTableauAvecId[]>(({ siDéfini }) =>
        constl.bds.suivreTableauxBd({
          idBd,
          f: siDéfini(),
        }),
      );
      expect(tableaux).to.be.an.empty("array");
    });

    it("Ajout d'un tableau", async () => {
      idTableau = await constl.bds.ajouterTableauBd({
        idBd,
        clefTableau: "abc",
      });
      expect(isValidAddress(idTableau)).to.be.true();

      const tableaux = await obtenir<infoTableauAvecId[]>(({ siPasVide }) =>
        constl.bds.suivreTableauxBd({
          idBd,
          f: siPasVide(),
        }),
      );
      expect(Array.isArray(tableaux)).to.be.true();
      expect(tableaux.length).to.equal(1);
      expect(tableaux).to.have.deep.members([
        {
          id: idTableau,
          clef: "abc",
        },
      ]);
    });

    it("Accès au tableau", async () => {
      const accèsTableau = await obtenir(({ siDéfini }) =>
        constl.suivrePermissionÉcrire({
          id: idTableau,
          f: siDéfini(),
        }),
      );
      expect(accèsTableau).to.be.true();
    });

    it("Suivre colonnes tableau", async () => {
      const idVariable = await constl.variables.créerVariable({
        catégorie: "vidéo",
      });
      const idColonne = await constl.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable,
      });
      const colonnes = await obtenir<InfoCol[]>(({ siPasVide }) =>
        constl.tableaux.suivreColonnesTableau({
          idTableau,
          f: siPasVide(),
        }),
      );
      expect(colonnes[0].id).to.eq(idColonne);
      expect(colonnes[0].variable).to.eq(idVariable);
    });

    it("Réordonner tableaux", async () => {
      const idTableau2 = await constl.bds.ajouterTableauBd({ idBd });

      const tableauxAvant = await obtenir<infoTableauAvecId[]>(({ si }) =>
        constl.bds.suivreTableauxBd({
          idBd,
          f: si((t) => t.length > 1),
        }),
      );

      expect(tableauxAvant.map((t) => t.id)).to.deep.equal([
        idTableau,
        idTableau2,
      ]);

      await constl.bds.réordonnerTableauBd({
        idBd,
        idTableau: idTableau,
        position: 1,
      });

      const tableaux = await obtenir<infoTableauAvecId[]>(({ si }) =>
        constl.bds.suivreTableauxBd({
          idBd,
          f: si((t) => !!t.length && t[0].id !== idTableau),
        }),
      );
      expect(tableaux.map((t) => t.id)).to.deep.equal([idTableau2, idTableau]);

      await constl.bds.effacerTableauBd({ idBd, idTableau: idTableau2 });
    });

    it("Effacer un tableau", async () => {
      await constl.bds.effacerTableauBd({ idBd, idTableau });

      const tableaux = await obtenir<infoTableauAvecId[]>(({ siVide }) =>
        constl.bds.suivreTableauxBd({
          idBd,
          f: siVide(),
        }),
      );
      expect(tableaux).to.be.an.empty("array");
    });
  });

  describe("Variables", function () {
    let idTableau: string;
    let idVariable: string;
    let idColonne: string;
    let idBd: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("Pas de variables pour commencer", async () => {
      const variables = await obtenir<string[]>(({ siDéfini }) =>
        constl.bds.suivreVariablesBd({
          idBd,
          f: siDéfini(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });

    it("Ajout d'un tableau et d'une variable", async () => {
      idTableau = await constl.bds.ajouterTableauBd({ idBd });
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      idColonne = await constl.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable,
      });

      const variables = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreVariablesBd({
          idBd,
          f: siPasVide(),
        }),
      );
      expect(Array.isArray(variables)).to.be.true();
      expect(variables.length).to.equal(1);
      expect(variables[0]).to.equal(idVariable);
    });

    it("Effacer une variable", async () => {
      await constl.tableaux.effacerColonneTableau({
        idTableau,
        idColonne,
      });
      const variables = await obtenir<string[]>(({ siVide }) =>
        constl.bds.suivreVariablesBd({
          idBd,
          f: siVide(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });
  });

  describe("Copier BD", function () {
    let idBdOrig: string;
    let idBdCopie: string;

    let idMotClef: string;
    let idVariable: string;
    let idTableau: string;

    const réfNoms = {
      த: "மழை",
      हिं: "बारिश",
    };
    const réfDescrs = {
      த: "தினசரி மழை",
      हिं: "दैनिक बारिश",
    };
    const réfLicence = "ODbl-1_0";

    before(async () => {
      idBdOrig = await constl.bds.créerBd({ licence: réfLicence });

      await Promise.all([
        constl.bds.sauvegarderNomsBd({
          idBd: idBdOrig,
          noms: réfNoms,
        }),
        constl.bds.sauvegarderDescriptionsBd({
          idBd: idBdOrig,
          descriptions: réfDescrs,
        }),
        (async () => {
          idMotClef = await constl.motsClefs.créerMotClef();
          await constl.bds.ajouterMotsClefsBd({
            idBd: idBdOrig,
            idsMotsClefs: idMotClef,
          });
        })(),
        (async () => {
          idTableau = await constl.bds.ajouterTableauBd({ idBd: idBdOrig });

          idVariable = await constl.variables.créerVariable({
            catégorie: "numérique",
          });
          await constl.tableaux.ajouterColonneTableau({
            idTableau,
            idVariable,
          });
        })(),
      ]);
    });

    it("Copier la bd", async () => {
      idBdCopie = await constl.bds.copierBd({ idBd: idBdOrig });
      expect(idBdCopie).to.be.a("string");
    });

    it("Les noms sont copiés", async () => {
      const noms = await obtenir<TraducsNom>(({ siPasVide }) =>
        constl.bds.suivreNomsBd({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(noms).to.deep.equal(réfNoms);
    });
    it("Les descriptions sont copiées", async () => {
      const descrs = await obtenir<TraducsNom>(({ siPasVide }) =>
        constl.bds.suivreDescriptionsBd({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(descrs).to.deep.equal(réfDescrs);
    });
    it("La licence est copiée", async () => {
      const licence = await obtenir<string>(({ siDéfini }) =>
        constl.bds.suivreLicenceBd({ idBd: idBdCopie, f: siDéfini() }),
      );
      expect(licence).to.equal(réfLicence);
    });
    it("Les mots-clefs sont copiés", async () => {
      const motsClefs = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreMotsClefsBd({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(motsClefs).to.have.members([idMotClef]);
    });
    it("Les tableaux sont copiés", async () => {
      const tableaux = await obtenir<infoTableauAvecId[]>(({ siPasVide }) =>
        constl.bds.suivreTableauxBd({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(Array.isArray(tableaux)).to.be.true();
      expect(tableaux.length).to.equal(1);
    });
    it("Les variables sont copiées", async () => {
      const variables = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.suivreVariablesBd({ idBd: idBdCopie, f: siPasVide() }),
      );
      expect(variables).to.have.members([idVariable]);
    });
  });

  describe("Combiner BDs", function () {
    let idVarClef: string;
    let idVarTrad: string;

    let idBd1: string;
    let idBd2: string;

    let idTableau1: string;
    let idTableau2: string;

    before(async () => {
      idVarClef = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTrad = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      const schéma: schémaSpécificationBd = {
        licence: "ODbl-1_0",
        tableaux: [
          {
            cols: [
              {
                idVariable: idVarClef,
                idColonne: "clef",
                index: true,
              },
              {
                idVariable: idVarTrad,
                idColonne: "trad",
              },
            ],
            clef: "tableau trads",
          },
        ],
      };

      idBd1 = await constl.bds.créerBdDeSchéma({ schéma });
      idBd2 = await constl.bds.créerBdDeSchéma({ schéma });

      idTableau1 = (
        await uneFois(
          async (
            fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
          ): Promise<schémaFonctionOublier> => {
            return await constl.bds.suivreTableauxBd({
              idBd: idBd1,
              f: fSuivi,
            });
          },
        )
      )[0].id;
      idTableau2 = (
        await uneFois(
          async (
            fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>,
          ): Promise<schémaFonctionOublier> => {
            return await constl.bds.suivreTableauxBd({
              idBd: idBd2,
              f: fSuivi,
            });
          },
        )
      )[0].id;

      type élémentTrad = { clef: string; trad?: string };

      const éléments1: élémentTrad[] = [
        {
          clef: "fr",
          trad: "Constellation",
        },
        {
          clef: "kaq", // Une traduction vide, par erreur disons
        },
      ];
      for (const élément of éléments1) {
        await constl.tableaux.ajouterÉlément({
          idTableau: idTableau1,
          vals: élément,
        });
      }

      const éléments2: élémentTrad[] = [
        {
          clef: "fr",
          trad: "Constellation!", // Une erreur ici, disons
        },
        {
          clef: "kaq",
          trad: "Ch'umil",
        },
        {
          clef: "हिं",
          trad: "तारामंडल",
        },
      ];
      for (const élément of éléments2) {
        await constl.tableaux.ajouterÉlément({
          idTableau: idTableau2,
          vals: élément,
        });
      }
    });

    it("Combiner les bds", async () => {
      await constl.bds.combinerBds({ idBdBase: idBd1, idBd2 });
    });

    it("Les données sont copiées", async () => {
      const données = await obtenir<élémentDonnées<élémentBdListeDonnées>[]>(
        ({ si }) =>
          constl.tableaux.suivreDonnées({
            idTableau: idTableau1,
            f: si(
              (x) =>
                x.length > 2 &&
                x.every((y) => Object.keys(y.données).length > 1),
            ),
            clefsSelonVariables: true,
          }),
      );
      const donnéesSansId = données.map((d) => d.données);
      expect(Array.isArray(donnéesSansId)).to.be.true();

      expect(donnéesSansId.length).to.equal(3);
      expect(donnéesSansId).to.have.deep.members([
        { [idVarClef]: "fr", [idVarTrad]: "Constellation" },
        { [idVarClef]: "kaq", [idVarTrad]: "Ch'umil" },
        { [idVarClef]: "हिं", [idVarTrad]: "तारामंडल" },
      ]);
    });
  });

  describe("Créer BD de schéma", function () {
    let idVarClef: string;
    let idVarTrad: string;
    let idVarLangue: string;

    let idMotClef: string;

    let idBd: string;

    before(async () => {
      idVarClef = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTrad = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarLangue = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      idMotClef = await constl.motsClefs.créerMotClef();

      const schéma: schémaSpécificationBd = {
        licence: "ODbl-1_0",
        motsClefs: [idMotClef],
        tableaux: [
          {
            cols: [
              {
                idVariable: idVarClef,
                idColonne: "clef",
                index: true,
              },
              {
                idVariable: idVarTrad,
                idColonne: "trad",
              },
            ],
            clef: "tableau trads",
          },
          {
            cols: [
              {
                idVariable: idVarLangue,
                idColonne: "langue",
                index: true,
              },
            ],
            clef: "tableau langues",
          },
        ],
      };

      idBd = await constl.bds.créerBdDeSchéma({ schéma });
    });

    it("Les tableaux sont créés", async () => {
      const tableaux = await obtenir<infoTableauAvecId[]>(({ siPasVide }) =>
        constl.bds.suivreTableauxBd({
          idBd,
          f: siPasVide(),
        }),
      );

      expect(Array.isArray(tableaux)).to.be.true();
      expect(tableaux.length).to.equal(2);
    });

    it("Colonnes", async () => {
      const tableaux = await obtenir<infoTableauAvecId[]>(({ siDéfini }) =>
        constl.bds.suivreTableauxBd({
          idBd,
          f: siDéfini(),
        }),
      );
      const colonnes = await obtenir<InfoColAvecCatégorie[]>(({ si }) =>
        constl.tableaux.suivreColonnesEtCatégoriesTableau({
          idTableau: tableaux[0].id,
          f: si((c) => c !== undefined && c.length > 1),
        }),
      );

      const idsColonnes = colonnes.map((c) => c.id);
      expect(Array.isArray(idsColonnes)).to.be.true();

      expect(idsColonnes.length).to.equal(2);
      expect(idsColonnes).to.have.members(["clef", "trad"]);
    });

    it("Mots clefs", async () => {
      const motsClefs = await obtenir<string[]>(({ si }) =>
        constl.bds.suivreMotsClefsBd({
          idBd,
          f: si((x) => x.length > 0),
        }),
      );
      expect(Array.isArray(motsClefs)).to.be.true();

      expect(motsClefs.length).to.equal(1);
      expect(motsClefs).to.have.members([idMotClef]);
    });

    it("Index colonne", async () => {
      const tableaux = await obtenir<infoTableauAvecId[]>(({ siDéfini }) =>
        constl.bds.suivreTableauxBd({
          idBd,
          f: siDéfini(),
        }),
      );
      const indexes = await obtenir<string[]>(
        ({ siPasVide }): Promise<schémaFonctionOublier> =>
          constl.tableaux.suivreIndex({
            idTableau: tableaux[0].id,
            f: siPasVide(),
          }),
      );
      expect(Array.isArray(indexes)).to.be.true();

      expect(indexes.length).to.equal(1);
      expect(indexes).to.have.members(["clef"]);
    });

    it("Tableaux unique détectable", async () => {
      const idTableau = await obtenir<string>(({ siDéfini }) =>
        constl.bds.suivreIdTableauParClef({
          idBd,
          clef: "tableau trads",
          f: siDéfini(),
        }),
      );

      expect(isValidAddress(idTableau)).to.be.true();
    });
  });

  describe("Nuées associées", async function () {
    it("Héritage des noms de bd de la nuée", async () => {
      const idNuée = await constl.nuées.créerNuée();
      await constl.nuées.sauvegarderNomNuée({
        idNuée,
        langue: "fra",
        nom: "Précipitation Montréal",
      });
      const idBd = await constl.bds.créerBd({ licence: "ODBl-1_0" });
      await constl.bds.rejoindreNuées({ idBd, idsNuées: idNuée });
      await constl.nuées.sauvegarderNomNuée({
        idNuée,
        langue: "తె",
        nom: "మోంరియాల్ అవపాతం",
      });
      const noms = await obtenir<{ [l: string]: string }>(({ si }) =>
        constl.bds.suivreNomsBd({
          idBd,
          f: si((noms) => Object.keys(noms).length > 1),
        }),
      );
      expect(noms).to.deep.equal({
        fra: "Précipitation Montréal",
        తె: "మోంరియాల్ అవపాతం",
      });
    });

    it("Héritage des noms de tableau de la nuée", async () => {
      const idNuée = await constl.nuées.créerNuée();
      const idTableau = await constl.nuées.ajouterTableauNuée({
        idNuée,
        clefTableau: "clef tableau",
      });

      await constl.nuées.sauvegarderNomsTableauNuée({
        idTableau,
        noms: { fra: "Précipitation Montréal" },
      });

      const idBd = await constl.bds.créerBdDeNuée({
        idNuée,
        licence: "ODBl-1_0",
      });

      await constl.nuées.sauvegarderNomsTableauNuée({
        idTableau,
        noms: { తె: "మోంరియాల్ అవపాతం" },
      });

      const tableauxBd = await obtenir<infoTableauAvecId[]>(({ si }) =>
        constl.bds.suivreTableauxBd({ idBd, f: si((tblx) => tblx.length > 0) }),
      );
      const noms = await obtenir<{ [l: string]: string }>(({ si }) =>
        constl.bds.suivreNomsTableau({
          idBd,
          idTableau: tableauxBd[0].id,
          f: si((noms) => Object.keys(noms).length > 1),
        }),
      );
      expect(noms).to.deep.equal({
        fra: "Précipitation Montréal",
        తె: "మోంరియాల్ అవపాతం",
      });
    });

    it("Héritage des mots-clefs de la nuée", async () => {
      const idNuée = await constl.nuées.créerNuée();
      const idMotClef = await constl.motsClefs.créerMotClef();
      await constl.nuées.ajouterMotsClefsNuée({
        idNuée,
        idsMotsClefs: idMotClef,
      });

      const idBd = await constl.bds.créerBdDeNuée({
        idNuée,
        licence: "ODBl-1_0",
      });

      const motsClefsBd = await obtenir<string[]>(({ si }) =>
        constl.bds.suivreMotsClefsBd({
          idBd: idBd,
          f: si((motsClefs) => motsClefs.length > 0),
        }),
      );
      expect(motsClefsBd).to.deep.equal([idMotClef]);
    });
  });

  describe("Suivre BD unique", function () {
    let idVarClef: string;
    let idVarTrad: string;
    let idVarLangue: string;
    let idNuée: string;
    let schéma: schémaSpécificationBd;

    before(async () => {
      idVarClef = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTrad = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarLangue = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      idNuée = await constl.nuées.créerNuée();

      schéma = {
        licence: "ODbl-1_0",
        tableaux: [
          {
            cols: [
              {
                idVariable: idVarClef,
                idColonne: "clef",
                index: true,
              },
              {
                idVariable: idVarTrad,
                idColonne: "trad",
              },
            ],
            clef: "tableau trads",
          },
          {
            cols: [
              {
                idVariable: idVarLangue,
                idColonne: "langue",
                index: true,
              },
            ],
            clef: "tableau langues",
          },
        ],
      };
    });

    it("La BD est créée lorsqu'elle n'existe pas", async () => {
      const idBd = await obtenir(({ siDéfini }) =>
        constl.bds.suivreBdUnique({
          schéma,
          idNuéeUnique: idNuée,
          f: siDéfini(),
        }),
      );
      expect(isValidAddress(idBd)).to.be.true();
    });
    it.skip("Gestion de la concurrence entre dispositifs");
    it.skip("Gestion de concurrence entre 2+ BDs");
  });

  describe("Suivre tableau unique", function () {
    let idBd: string;
    let idTableau: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });

      idTableau = await constl.bds.ajouterTableauBd({ idBd });
    });

    it("Rien pour commencer", async () => {
      const tableauUnique = await obtenir(({ tous }) =>
        constl.bds.suivreIdTableauParClef({
          idBd: idBd,
          clef: "clefUnique",
          f: tous(),
        }),
      );

      expect(tableauUnique).to.be.undefined();
    });
    it("Ajout de clef détecté", async () => {
      await constl.bds.spécifierClefTableau({
        idBd,
        idTableau,
        clef: "clefUnique",
      });
      const idTableauDeClef = await obtenir<string>(({ siDéfini }) =>
        constl.bds.suivreIdTableauParClef({
          idBd: idBd,
          clef: "clefUnique",
          f: siDéfini(),
        }),
      );
      expect(idTableauDeClef).to.equal(idTableau);
    });
  });

  describe("Suivre tableau unique de BD unique", function () {
    let idVarClef: string;
    let idVarTrad: string;
    let idNuée: string;
    let schéma: schémaSpécificationBd;

    before(async () => {
      idVarClef = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTrad = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      idNuée = await constl.nuées.créerNuée();

      schéma = {
        licence: "ODbl-1_0",
        tableaux: [
          {
            cols: [
              {
                idVariable: idVarClef,
                idColonne: "clef",
                index: true,
              },
              {
                idVariable: idVarTrad,
                idColonne: "trad",
              },
            ],
            clef: "id tableau unique",
          },
        ],
      };
    });

    it("Tableau unique détecté", async () => {
      const idTableau = await obtenir(({ siDéfini }) =>
        constl.bds.suivreIdTableauParClefDeBdUnique({
          schémaBd: schéma,
          idNuéeUnique: idNuée,
          clefTableau: "id tableau unique",
          f: siDéfini(),
        }),
      );
      expect(isValidAddress(idTableau)).to.be.true();
    });
  });

  describe("Score", function () {
    let idBd: string;
    let idTableau: string;
    let idVarNumérique: string;
    let idVarChaîne: string;
    let idVarNumérique2: string;

    let idColNumérique: string;
    let idColNumérique2: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idTableau = await constl.bds.ajouterTableauBd({ idBd });

      idVarNumérique = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      idVarNumérique2 = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      idVarChaîne = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
    });

    describe("Score accessibilité", function () {
      it.skip("À faire");
    });

    describe("Score couverture tests", function () {
      it("`undefined` lorsque aucune colonne", async () => {
        const score = await obtenir<infoScore>(({ siDéfini }) =>
          constl.bds.suivreQualitéBd({
            idBd,
            f: siDéfini(),
          }),
        );
        expect(score.couverture).to.be.undefined();
      });

      it("Ajout de colonnes", async () => {
        idColNumérique = await constl.tableaux.ajouterColonneTableau({
          idTableau,
          idVariable: idVarNumérique,
        });
        idColNumérique2 = await constl.tableaux.ajouterColonneTableau({
          idTableau,
          idVariable: idVarNumérique2,
        });
        await constl.tableaux.ajouterColonneTableau({
          idTableau,
          idVariable: idVarChaîne,
        });
        const score = await obtenir<infoScore>(({ si }) =>
          constl.bds.suivreQualitéBd({
            idBd,
            f: si((s) => s.couverture !== undefined),
          }),
        );
        expect(score.couverture).to.equal(0);
      });

      it("Ajout de règles", async () => {
        const règleNumérique: règleBornes = {
          typeRègle: "bornes",
          détails: { type: "fixe", val: 0, op: ">=" },
        };
        await constl.tableaux.ajouterRègleTableau({
          idTableau,
          idColonne: idColNumérique,
          règle: règleNumérique,
        });
        let score = await obtenir<infoScore>(({ si }) =>
          constl.bds.suivreQualitéBd({
            idBd,
            f: si((s) => !!s.couverture && s.couverture > 0),
          }),
        );
        expect(score.couverture).to.equal(0.5);

        await constl.tableaux.ajouterRègleTableau({
          idTableau,
          idColonne: idColNumérique2,
          règle: règleNumérique,
        });
        score = await obtenir<infoScore>(({ si }) =>
          constl.bds.suivreQualitéBd({
            idBd,
            f: si((s) => !!s.couverture && s.couverture > 0.5),
          }),
        );
        expect(score.couverture).to.equal(1);
      });
    });

    describe("Score validité", function () {
      let idÉlément: string;

      it("`undefined` pour commencer", async () => {
        const score = await obtenir<infoScore>(({ siDéfini }) =>
          constl.bds.suivreQualitéBd({
            idBd,
            f: siDéfini(),
          }),
        );
        expect(score.valide).to.be.undefined();
      });

      it("Ajout d'éléments", async () => {
        idÉlément = (
          await constl.tableaux.ajouterÉlément({
            idTableau,
            vals: {
              [idColNumérique]: -1,
              [idColNumérique2]: 1,
            },
          })
        )[0];
        let score = await obtenir<infoScore>(({ si }) =>
          constl.bds.suivreQualitéBd({
            idBd,
            f: si((s) => !!s.valide && s.valide == 0.5),
          }),
        );
        expect(score.valide).to.equal(0.5);
        await constl.tableaux.ajouterÉlément({
          idTableau,
          vals: {
            [idColNumérique]: 1,
          },
        });
        score = await obtenir<infoScore>(({ si }) =>
          constl.bds.suivreQualitéBd({
            idBd,
            f: si((s) => !!s.valide && s.valide > 0.5),
          }),
        );
        expect(score.valide).to.equal(2 / 3);
      });

      it("Correction des éléments", async () => {
        await constl.tableaux.modifierÉlément({
          idTableau,
          vals: { [idColNumérique]: 12 },
          idÉlément,
        });
        const score = await obtenir<infoScore>(({ si }) =>
          constl.bds.suivreQualitéBd({
            idBd,
            f: si((s) => !!s.valide && s.valide > 2 / 3),
          }),
        );
        expect(score.valide).to.equal(1);
      });
    });

    describe("Score total", function () {
      it("Calcul du score total", async () => {
        const score = await obtenir<infoScore>(({ siDéfini }) =>
          constl.bds.suivreQualitéBd({
            idBd,
            f: siDéfini(),
          }),
        );
        const total =
          ((score.accès || 0) + (score.couverture || 0) + (score.valide || 0)) /
          3;
        expect(score.total).to.equal(total);
      });
    });
  });

  describe("Exporter données", function () {
    let idBd: string;
    let doc: XLSX.WorkBook;
    let fichiersSFIP: Set<string>;
    let nomFichier: string;
    let cid: string;

    const nomTableau1 = "Tableau 1";
    const nomTableau2 = "Tableau 2";

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });

      const idTableau1 = await constl.bds.ajouterTableauBd({ idBd });
      const idTableau2 = await constl.bds.ajouterTableauBd({ idBd });

      const idVarNum = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      const idVarFichier = await constl.variables.créerVariable({
        catégorie: "fichier",
      });
      await constl.tableaux.ajouterColonneTableau({
        idTableau: idTableau1,
        idVariable: idVarNum,
      });
      const idColFichier = await constl.tableaux.ajouterColonneTableau({
        idTableau: idTableau2,
        idVariable: idVarFichier,
      });

      const octets = await obtRessourceTest({
        nomFichier: "logo.svg",
      });
      cid = await constl.ajouterÀSFIP({
        contenu: octets,
        nomFichier: "logo.svg",
      });

      await constl.tableaux.ajouterÉlément({
        idTableau: idTableau2,
        vals: {
          [idColFichier]: cid,
        },
      });

      await constl.tableaux.sauvegarderNomsTableau({
        idTableau: idTableau1,
        noms: {
          fr: nomTableau1,
        },
      });
      await constl.tableaux.sauvegarderNomsTableau({
        idTableau: idTableau2,
        noms: {
          fr: nomTableau2,
        },
      });

      ({ doc, fichiersSFIP, nomFichier } = await constl.bds.exporterDonnées({
        idBd,
        langues: ["fr"],
      }));
    });

    it("Doc créé avec tous les tableaux", () => {
      expect(Array.isArray(doc.SheetNames));
      expect(doc.SheetNames).to.have.members([nomTableau1, nomTableau2]);
    });
    it("Fichiers SFIP retrouvés de tous les tableaux", () => {
      expect(isSet(fichiersSFIP)).to.be.true();
      expect(fichiersSFIP.size).to.equal(1);
      expect([...fichiersSFIP]).to.have.deep.members([cid]);
    });

    describe("Exporter document données", function () {
      if (isElectronMain || isNode) {
        let dossierZip: string;
        let fEffacer: () => void;
        let zip: JSZip;

        before(async () => {
          ({ dossier: dossierZip, fEffacer } = await dossiers.dossierTempo());

          await constl.bds.documentDonnéesÀFichier({
            données: { doc, fichiersSFIP, nomFichier },
            formatDoc: "ods",
            dossier: dossierZip,
            inclureDocuments: true,
          });
        });

        after(() => {
          if (fEffacer) fEffacer();
        });

        it("Le fichier zip existe", async () => {
          const nomZip = path.join(dossierZip, nomFichier + ".zip");
          expect(fs.existsSync(nomZip)).to.be.true();
          zip = await JSZip.loadAsync(fs.readFileSync(nomZip));
        });

        it("Les données sont exportées", () => {
          const contenu = zip.files[nomFichier + ".ods"];
          expect(contenu).to.exist();
        });

        it("Le dossier pour les données SFIP existe", () => {
          const contenu = zip.files["sfip/"];
          expect(contenu?.dir).to.be.true();
        });

        it("Les fichiers SFIP existent", () => {
          const contenu = zip.files[["sfip", cid.replace("/", "-")].join("/")];
          expect(contenu).to.exist();
        });
      }
    });
  });

  describe("Rechercher BDs par mot-clef", function () {
    let idMotClef: string;
    let idBdRechercheMotsClefs: string;

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();

      idBdRechercheMotsClefs = await constl.bds.créerBd({
        licence: "ODbl-1_0",
      });
    });

    it("Pas de résultats pour commencer", async () => {
      const bds = await obtenir(({ siDéfini }) =>
        constl.bds.rechercherBdsParMotsClefs({
          motsClefs: [idMotClef],
          f: siDéfini(),
        }),
      );
      expect(bds).to.be.an.empty("array");
    });

    it("Ajout d'un mot-clef détecté", async () => {
      await constl.bds.ajouterMotsClefsBd({
        idBd: idBdRechercheMotsClefs,
        idsMotsClefs: [idMotClef],
      });

      const bds = await obtenir<string[]>(({ siPasVide }) =>
        constl.bds.rechercherBdsParMotsClefs({
          motsClefs: [idMotClef],
          f: siPasVide(),
        }),
      );
      expect(Array.isArray(bds)).to.be.true();
      expect(bds.length).to.equal(1);
      expect(bds[0]).to.equal(idBdRechercheMotsClefs);
    });
  });
});
