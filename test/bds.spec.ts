import fs from "fs";
import path from "path";

import { isSet } from "lodash-es";

import { dossiers } from "@constl/utils-tests";

import { uneFois, obtenir } from "@constl/utils-ipa";
import { isValidAddress } from "@orbitdb/core";

import { expect } from "aegir/chai";
import JSZip from "jszip";
import { isElectronMain, isNode } from "wherearewe";
import { schémaFonctionOublier, schémaFonctionSuivi } from "@/types.js";
import { obtRessourceTest } from "./ressources/index.js";
import type { règleBornes } from "@/valid.js";
import type {
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

describe("BDs", function () {
  describe("Combiner BDs", function () {
    
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
          type: "bornes",
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
});
