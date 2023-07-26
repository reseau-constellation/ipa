import type XLSX from "xlsx";
import fs from "fs";
import path from "path";

import pkg from "lodash";
const { isSet } = pkg;

import type { default as ClientConstellation } from "@/client.js";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  adresseOrbiteValide,
  uneFois,
} from "@/utils/index.js";
import type { InfoColAvecCatégorie } from "@/tableaux.js";
import type {
  infoScore,
  schémaSpécificationBd,
  infoTableauAvecId,
} from "@/bds.js";
import type { élémentBdListeDonnées } from "@/tableaux.js";
import type { élémentDonnées, règleBornes } from "@/valid.js";

import { générerClients, typesClients } from "@/utilsTests/client.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";
import {
  dossierTempoTests,
} from "@/utilsTests/dossiers.js";

import { expect } from "aegir/chai";
import JSZip from "jszip";
import { obtRessourceTest } from "./ressources/index.js";
import { isElectronMain, isNode } from "wherearewe";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("BDs", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      let idBd: string;
      let accèsBd: boolean;

      const fsOublier: schémaFonctionOublier[] = [];

      before(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      });

      after(async () => {
        if (fOublierClients) await fOublierClients();
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Création", async () => {
        idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
        expect(adresseOrbiteValide(idBd)).to.be.true();
      });
      it("Accès", async () => {
        fsOublier.push(
          await client.suivrePermissionÉcrire({
            id: idBd,
            f: (x) => (accèsBd = x),
          })
        );
        expect(accèsBd).to.be.true();
      });

      describe("Mes BDs", () => {
        let fOublier: schémaFonctionOublier;
        let idNouvelleBd: string;
        const bds = new AttendreRésultat<string[]>();

        before(async () => {
          fOublier = await client.bds!.suivreBds({
            f: (_bds) => bds.mettreÀJour(_bds),
          });
        });
        after(async () => {
          if (fOublier) await fOublier();
          bds.toutAnnuler();
        });
        it("La BD déjà créée est présente", async () => {
          const val = await bds.attendreExiste();
          expect(val).to.be.an("array").and.to.contain(idBd);
        });
        it("On crée une autre BD sans l'ajouter", async () => {
          idNouvelleBd = await client.bds!.créerBd({
            licence: "ODbl-1_0",
            ajouter: false,
          });
          const val = bds.val;
          expect(val).to.be.an("array").with.length(1).and.contain(idBd);
        });
        it("On peut l'ajouter ensuite à mes bds", async () => {
          await client.bds!.ajouterÀMesBds({ idBd: idNouvelleBd });
          const val = await bds.attendreQue((x) => x.length > 1);
          expect(val)
            .to.be.an("array")
            .with.length(2)
            .to.have.members([idNouvelleBd, idBd]);
        });
        it("On peut aussi l'effacer", async () => {
          await client.bds!.effacerBd({ idBd: idNouvelleBd });
          const val = await bds.attendreQue((x) => x.length < 2);
          expect(val).to.be.an("array").with.length(1).and.contain(idBd);
        });
      });

      describe("Noms", function () {
        let noms: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        before(async () => {
          fOublier = await client.bds!.suivreNomsBd({
            idBd,
            f: (n) => (noms = n),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Pas de noms pour commencer", async () => {
          expect(Object.keys(noms).length).to.equal(0);
        });

        it("Ajouter un nom", async () => {
          await client.bds!.sauvegarderNomBd({
            idBd,
            langue: "fr",
            nom: "Alphabets",
          });
          expect(noms.fr).to.equal("Alphabets");
        });

        it("Ajouter des noms", async () => {
          await client.bds!.sauvegarderNomsBd({
            idBd,
            noms: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          expect(noms).to.deep.equal({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        it("Changer un nom", async () => {
          await client.bds!.sauvegarderNomBd({
            idBd,
            langue: "fr",
            nom: "Systèmes d'écriture",
          });
          expect(noms?.fr).to.equal("Systèmes d'écriture");
        });

        it("Effacer un nom", async () => {
          await client.bds!.effacerNomBd({ idBd, langue: "fr" });
          expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Descriptions", function () {
        let descrs: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        before(async () => {
          fOublier = await client.bds!.suivreDescriptionsBd({
            idBd,
            f: (d) => (descrs = d),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Aucune description pour commencer", async () => {
          expect(Object.keys(descrs).length).to.equal(0);
        });

        it("Ajouter une description", async () => {
          await client.bds!.sauvegarderDescriptionBd({
            idBd,
            langue: "fr",
            descr: "Alphabets",
          });
          expect(descrs.fr).to.equal("Alphabets");
        });

        it("Ajouter des descriptions", async () => {
          await client.bds!.sauvegarderDescriptionsBd({
            idBd,
            descriptions: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          expect(descrs).to.deep.equal({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        it("Changer une description", async () => {
          await client.bds!.sauvegarderDescriptionBd({
            idBd,
            langue: "fr",
            descr: "Systèmes d'écriture",
          });
          expect(descrs?.fr).to.equal("Systèmes d'écriture");
        });

        it("Effacer une description", async () => {
          await client.bds!.effacerDescriptionBd({ idBd, langue: "fr" });
          expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Mots-clefs", function () {
        let motsClefs: string[];
        let fOublier: schémaFonctionOublier;
        let idMotClef: string;

        before(async () => {
          fOublier = await client.bds!.suivreMotsClefsBd({
            idBd,
            f: (m) => (motsClefs = m),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });
        it("Pas de mots-clefs pour commencer", async () => {
          expect(Array.isArray(motsClefs)).to.be.true();
          expect(motsClefs.length).to.equal(0);
        });
        it("Ajout d'un mot-clef", async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          await client.bds!.ajouterMotsClefsBd({
            idBd,
            idsMotsClefs: idMotClef,
          });
          expect(Array.isArray(motsClefs)).to.be.true();
          expect(motsClefs.length).to.equal(1);
        });
        it("Effacer un mot-clef", async () => {
          await client.bds!.effacerMotClefBd({ idBd, idMotClef });
          expect(Array.isArray(motsClefs)).to.be.true();
          expect(motsClefs.length).to.equal(0);
        });
      });

      describe("Changer licence BD", function () {
        let idBd: string;
        let licence: string;
        let fOublier: schémaFonctionOublier;

        before(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          fOublier = await client.bds!.suivreLicence({
            idBd,
            f: (l) => (licence = l),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Licence originale présente", async () => {
          expect(licence).to.equal("ODbl-1_0");
        });

        it("Changement de licence", async () => {
          await client.bds!.changerLicenceBd({ idBd, licence: "ODC-BY-1_0" });
          expect(licence).to.equal("ODC-BY-1_0");
        });
      });

      describe("Statut BD", function () {
        it.skip("À faire");
      });

      describe("Tableaux", function () {
        let tableaux: infoTableauAvecId[];
        let idTableau: string;
        let accèsTableau: boolean;

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          fsOublier.push(
            await client.bds!.suivreTableauxBd({
              idBd,
              f: (t) => (tableaux = t),
            })
          );
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("Pas de tableaux pour commencer", async () => {
          expect(Array.isArray(tableaux)).to.be.true();
          expect(tableaux.length).to.equal(0);
        });

        it("Ajout d'un tableau", async () => {
          idTableau = await client.bds!.ajouterTableauBd({
            idBd,
            clefTableau: "abc",
          });
          expect(adresseOrbiteValide(idTableau)).to.be.true();
          expect(Array.isArray(tableaux)).to.be.true();
          expect(tableaux.length).to.equal(1);
          expect(tableaux).to.have.deep.members([
            {
              id: idTableau,
              clef: "abc",
              position: 0,
            },
          ]);
        });

        it("Accès au tableau", async () => {
          fsOublier.push(
            await client.suivrePermissionÉcrire({
              id: idTableau,
              f: (x) => (accèsTableau = x),
            })
          );
          expect(accèsTableau).to.be.true();
        });

        it("Effacer un tableau", async () => {
          await client.bds!.effacerTableauBd({ idBd, idTableau });
          expect(Array.isArray(tableaux)).to.be.true();
          expect(tableaux.length).to.equal(0);
        });
      });

      describe("Variables", function () {
        let variables: string[];
        let fOublier: schémaFonctionOublier;
        let idTableau: string;
        let idVariable: string;
        let idColonne: string;

        before(async () => {
          fOublier = await client.bds!.suivreVariablesBd({
            idBd,
            f: (v) => (variables = v),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });
        it("Pas de variables pour commencer", async () => {
          expect(Array.isArray(variables)).to.be.true();
          expect(variables.length).to.equal(0);
        });
        it("Ajout d'un tableau et d'une variable", async () => {
          idTableau = await client.bds!.ajouterTableauBd({ idBd });
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });

          idColonne = await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable,
          });

          expect(Array.isArray(variables)).to.be.true();
          expect(variables.length).to.equal(1);
          expect(variables[0]).to.equal(idVariable);
        });
        it("Effacer une variable", async () => {
          await client.tableaux!.effacerColonneTableau({
            idTableau,
            idColonne,
          });
          expect(Array.isArray(variables)).to.be.true();
          expect(variables.length).to.equal(0);
        });
      });

      describe("Copier BD", function () {
        let idBdOrig: string;
        let idBdCopie: string;

        let idMotClef: string;
        let idVariable: string;
        let idTableau: string;

        let noms: { [key: string]: string };
        let descrs: { [key: string]: string };
        let licence: string;
        let motsClefs: string[];
        let variables: string[];
        let tableaux: infoTableauAvecId[];

        const réfNoms = {
          த: "மழை",
          हिं: "बारिश",
        };
        const réfDescrs = {
          த: "தினசரி மழை",
          हिं: "दैनिक बारिश",
        };
        const réfLicence = "ODbl-1_0";

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          idBdOrig = await client.bds!.créerBd({ licence: réfLicence });

          await client.bds!.sauvegarderNomsBd({ idBd: idBdOrig, noms: réfNoms });
          await client.bds!.sauvegarderDescriptionsBd({
            idBd: idBdOrig,
            descriptions: réfDescrs,
          });

          idMotClef = await client.motsClefs!.créerMotClef();
          await client.bds!.ajouterMotsClefsBd({
            idBd: idBdOrig,
            idsMotsClefs: idMotClef,
          });

          idTableau = await client.bds!.ajouterTableauBd({ idBd: idBdOrig });

          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable,
          });

          idBdCopie = await client.bds!.copierBd({ idBd: idBdOrig });

          fsOublier.push(
            await client.bds!.suivreNomsBd({
              idBd: idBdCopie,
              f: (x) => (noms = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreDescriptionsBd({
              idBd: idBdCopie,
              f: (x) => (descrs = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreLicence({
              idBd: idBdCopie,
              f: (x) => (licence = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreMotsClefsBd({
              idBd: idBdCopie,
              f: (x) => (motsClefs = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreVariablesBd({
              idBd: idBdCopie,
              f: (x) => (variables = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreTableauxBd({
              idBd: idBdCopie,
              f: (x) => (tableaux = x),
            })
          );
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("Les noms sont copiés", async () => {
          expect(noms).to.deep.equal(réfNoms);
        });
        it("Les descriptions sont copiées", async () => {
          expect(descrs).to.deep.equal(réfDescrs);
        });
        it("La licence est copiée", async () => {
          expect(licence).to.equal(réfLicence);
        });
        it("Les mots-clefs sont copiés", async () => {
          expect(motsClefs).to.have.members([idMotClef]);
        });
        it("Les tableaux sont copiés", async () => {
          expect(Array.isArray(tableaux)).to.be.true();
          expect(tableaux.length).to.equal(1);
        });
        it("Les variables sont copiées", async () => {
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

        let données1: élémentDonnées<élémentBdListeDonnées>[];

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîneNonTraductible",
          });
          idVarTrad = await client.variables!.créerVariable({
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

          idBd1 = await client.bds!.créerBdDeSchéma({ schéma });
          idBd2 = await client.bds!.créerBdDeSchéma({ schéma });

          idTableau1 = (
            await uneFois(
              async (
                fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>
              ): Promise<schémaFonctionOublier> => {
                return await client.bds!.suivreTableauxBd({
                  idBd: idBd1,
                  f: fSuivi,
                });
              }
            )
          )[0].id;
          idTableau2 = (
            await uneFois(
              async (
                fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>
              ): Promise<schémaFonctionOublier> => {
                return await client.bds!.suivreTableauxBd({
                  idBd: idBd2,
                  f: fSuivi,
                });
              }
            )
          )[0].id;

          type élémentTrad = { clef: string; trad?: string };

          const éléments1: élémentTrad[] = [
            {
              clef: "fr",
              trad: "Constellation",
            },
            {
              clef: "kaq", // Une trad vide, par erreur disons
            },
          ];
          for (const élément of éléments1) {
            await client.tableaux!.ajouterÉlément({
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
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableau2,
              vals: élément,
            });
          }

          fsOublier.push(
            await client.tableaux!.suivreDonnées({
              idTableau: idTableau1,
              f: (d) => (données1 = d),
              clefsSelonVariables: true,
            })
          );

          await client.bds!.combinerBds({ idBdBase: idBd1, idBd2 });
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("Les données sont copiées", async () => {
          const donnéesCombinées = données1.map((d) => d.données);
          const donnéesSansId = donnéesCombinées.map((d) => {
            delete d.id;
            return d;
          });
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

        let tableaux: infoTableauAvecId[];
        let tableauUnique: string | undefined;

        const fsOublier: schémaFonctionOublier[] = [];

        before(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîneNonTraductible",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîneNonTraductible",
          });
          idVarLangue = await client.variables!.créerVariable({
            catégorie: "chaîneNonTraductible",
          });

          idMotClef = await client.motsClefs!.créerMotClef();

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

          idBd = await client.bds!.créerBdDeSchéma({ schéma });
          fsOublier.push(
            await client.bds!.suivreTableauxBd({
              idBd,
              f: (t) => (tableaux = t),
            })
          );
          fsOublier.push(
            await client.bds!.suivreIdTableauParClef({
              idBd,
              clef: "tableau trads",
              f: (t) => (tableauUnique = t),
            })
          );
        });

        after(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        it("Les tableaux sont créés", async () => {
          expect(Array.isArray(tableaux)).to.be.true();
          expect(tableaux.length).to.equal(2);
        });

        it("Colonnes", async () => {
          const colonnes = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<InfoColAvecCatégorie[]>
            ): Promise<schémaFonctionOublier> => {
              return await client.tableaux!.suivreColonnes({
                idTableau: tableaux[0].id,
                f: fSuivi,
              });
            }
          );

          const idsColonnes = colonnes.map((c) => c.id);
          expect(Array.isArray(idsColonnes)).to.be.true();

          expect(idsColonnes.length).to.equal(2);
          expect(idsColonnes).to.have.members(["clef", "trad"]);
        });

        it("Mots clefs", async () => {
          const motsClefs = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string[]>
            ): Promise<schémaFonctionOublier> => {
              return await client.bds!.suivreMotsClefsBd({
                idBd,
                f: fSuivi,
              });
            }
          );
          expect(Array.isArray(motsClefs)).to.be.true();

          expect(motsClefs.length).to.equal(1);
          expect(motsClefs).to.have.members([idMotClef]);
        });

        it("Index colonne", async () => {
          const indexes = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string[]>
            ): Promise<schémaFonctionOublier> => {
              return await client.tableaux!.suivreIndex({
                idTableau: tableaux[0].id,
                f: fSuivi,
              });
            }
          );
          expect(Array.isArray(indexes)).to.be.true();

          expect(indexes.length).to.equal(1);
          expect(indexes).to.have.members(["clef"]);
        });

        it("Tableaux unique détectable", async () => {
          expect(adresseOrbiteValide(tableauUnique)).to.be.true();
        });
      });

      describe("Suivre BD unique", function () {
        let idVarClef: string;
        let idVarTrad: string;
        let idVarLangue: string;

        let fOublier: schémaFonctionOublier;

        const rés = new AttendreRésultat<string>();

        before(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîneNonTraductible",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîneNonTraductible",
          });
          idVarLangue = await client.variables!.créerVariable({
            catégorie: "chaîneNonTraductible",
          });

          const idNuée = await client.nuées!.créerNuée({});

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

          fOublier = await client.bds!.suivreBdUnique({
            schéma,
            idNuéeUnique: idNuée,
            f: (id) => rés.mettreÀJour(id),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });
        it("La BD est créée lorsqu'elle n'existe pas", async () => {
          await rés.attendreExiste();
          expect(adresseOrbiteValide(rés.val)).to.be.true();
        });
        it.skip("Gestion de la concurrence entre dispositifs");
        it.skip("Gestion de concurrence entre 2+ BDs");
      });

      describe("Suivre tableau unique", function () {
        let idBd: string;
        let idTableau: string;

        let fOublier: schémaFonctionOublier;

        const rés = new AttendreRésultat<string>();

        before(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

          idTableau = await client.bds!.ajouterTableauBd({ idBd });

          fOublier = await client.bds!.suivreIdTableauParClef({
            idBd: idBd,
            clef: "clefUnique",
            f: (id) => rés.mettreÀJour(id),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });
        it("Rien pour commencer", async () => {
          expect(rés.val).to.be.undefined();
        });
        it("Ajout de clef détecté", async () => {
          await client.bds!.spécifierClefTableau({
            idBd,
            idTableau,
            clef: "clefUnique",
          });
          await rés.attendreExiste();
          expect(rés.val).to.equal(idTableau);
        });
      });

      describe("Suivre tableau unique de BD unique", function () {
        let idVarClef: string;
        let idVarTrad: string;

        let fOublier: schémaFonctionOublier;

        const rés = new AttendreRésultat<string>();

        before(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîneNonTraductible",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîneNonTraductible",
          });

          const idNuée = await client.nuées!.créerNuée({});

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
                clef: "id tableau unique",
              },
            ],
          };

          fOublier = await client.bds!.suivreIdTableauParClefDeBdUnique({
            schémaBd: schéma,
            idNuéeUnique: idNuée,
            clefTableau: "id tableau unique",
            f: (id) => rés.mettreÀJour(id),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });

        it("Tableau unique détecté", async () => {
          await rés.attendreExiste();
          expect(adresseOrbiteValide(rés.val)).to.be.true();
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

        let score: infoScore;

        let fOublier: schémaFonctionOublier;

        before(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          idTableau = await client.bds!.ajouterTableauBd({ idBd });

          idVarNumérique = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVarNumérique2 = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVarChaîne = await client.variables!.créerVariable({
            catégorie: "chaîneNonTraductible",
          });

          fOublier = await client.bds!.suivreQualitéBd({
            idBd,
            f: (s) => (score = s),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        describe("Score accessibilité", function () {
          it.skip("À faire");
        });

        describe("Score couverture tests", function () {
          it("`undefined` lorsque aucune colonne", async () => {
            expect(score.couverture).to.be.undefined();
          });

          it("Ajout de colonnes", async () => {
            idColNumérique = await client.tableaux!.ajouterColonneTableau({
              idTableau,
              idVariable: idVarNumérique,
            });
            idColNumérique2 = await client.tableaux!.ajouterColonneTableau({
              idTableau,
              idVariable: idVarNumérique2,
            });
            await client.tableaux!.ajouterColonneTableau({
              idTableau,
              idVariable: idVarChaîne,
            });
            expect(score.couverture).to.equal(0);
          });

          it("Ajout de règles", async () => {
            const règleNumérique: règleBornes = {
              typeRègle: "bornes",
              détails: { type: "fixe", val: 0, op: ">=" },
            };
            await client.tableaux!.ajouterRègleTableau({
              idTableau,
              idColonne: idColNumérique,
              règle: règleNumérique,
            });
            expect(score.couverture).to.equal(0.5);

            await client.tableaux!.ajouterRègleTableau({
              idTableau,
              idColonne: idColNumérique2,
              règle: règleNumérique,
            });
            expect(score.couverture).to.equal(1);
          });
        });

        describe("Score validité", function () {
          let empreinteÉlément: string;

          it("`undefined` pour commencer", async () => {
            expect(score.valide).to.be.undefined();
          });

          it("Ajout d'éléments", async () => {
            empreinteÉlément = await client.tableaux!.ajouterÉlément({
              idTableau,
              vals: {
                [idColNumérique]: -1,
                [idColNumérique2]: 1,
              },
            });
            expect(score.valide).to.equal(0.5);
            await client.tableaux!.ajouterÉlément({
              idTableau,
              vals: {
                [idColNumérique]: 1,
              },
            });
            expect(score.valide).to.equal(2 / 3);
          });

          it("Correction des éléments", async () => {
            await client.tableaux!.modifierÉlément({
              idTableau,
              vals: { [idColNumérique]: 12 },
              empreintePrécédente: empreinteÉlément,
            });
            expect(score.valide).to.equal(1);
          });
        });

        describe("Score total", function () {
          it("Calcul du score total", async () => {
            const total =
              ((score.accès || 0) +
                (score.couverture || 0) +
                (score.valide || 0)) /
              3;
            expect(score.total).to.equal(total);
          });
        });
      });

      describe("Exporter données", function () {
        let idBd: string;
        let doc: XLSX.WorkBook;
        let fichiersSFIP: Set<{ cid: string; ext: string }>;
        let nomFichier: string;
        let cid: string;

        const nomTableau1 = "Tableau 1";
        const nomTableau2 = "Tableau 2";

        before(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

          const idTableau1 = await client.bds!.ajouterTableauBd({ idBd });
          const idTableau2 = await client.bds!.ajouterTableauBd({ idBd });

          const idVarNum = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          const idVarFichier = await client.variables!.créerVariable({
            catégorie: "fichier",
          });
          await client.tableaux!.ajouterColonneTableau({
            idTableau: idTableau1,
            idVariable: idVarNum,
          });
          const idColFichier = await client.tableaux!.ajouterColonneTableau({
            idTableau: idTableau2,
            idVariable: idVarFichier,
          });

          const octets = await obtRessourceTest({nomFichier: "logo.svg", optsAxios: { responseType: "arraybuffer" }});
          cid = await client.ajouterÀSFIP({ fichier: octets });

          await client.tableaux!.ajouterÉlément({
            idTableau: idTableau2,
            vals: {
              [idColFichier]: {
                cid,
                ext: "svg",
              },
            },
          });

          await client.tableaux!.ajouterNomsTableau({
            idTableau: idTableau1,
            noms: {
              fr: nomTableau1,
            },
          });
          await client.tableaux!.ajouterNomsTableau({
            idTableau: idTableau2,
            noms: {
              fr: nomTableau2,
            },
          });

          ({ doc, fichiersSFIP, nomFichier } =
            await client.bds!.exporterDonnées({ idBd, langues: ["fr"] }));
        });

        it("Doc créé avec tous les tableaux", () => {
          expect(Array.isArray(doc.SheetNames));
          expect(doc.SheetNames).to.have.members([nomTableau1, nomTableau2]);
        });
        it("Fichiers SFIP retrouvés de tous les tableaux", () => {
          expect(isSet(fichiersSFIP)).to.be.true();
          expect(fichiersSFIP.size).to.equal(1);
          expect([...fichiersSFIP]).to.have.deep.members([{ cid, ext: "svg" }]);
        });

        describe("Exporter document données", function () {
          if (isElectronMain || isNode ) {
            let dossier: string;
            let fEffacer: () => void;
            let dirZip: string;
            let zip: JSZip;
  
            before(async () => {
              ({ dossier, fEffacer } = await dossierTempoTests());
              dirZip = path.join(dossier, "testExporterBd");
              await client.bds!.exporterDocumentDonnées({
                données: { doc, fichiersSFIP, nomFichier },
                formatDoc: "ods",
                dossier: dirZip,
                inclureFichiersSFIP: true,
              });
            });
  
            after(() => {
              if (fEffacer) fEffacer();
            });
  
            it("Le fichier zip existe", async () => {
              const nomZip = path.join(dirZip, nomFichier + ".zip");
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
              const contenu = zip.files[path.join("sfip", cid + ".svg")];
              expect(contenu).to.exist();
            });
          }

        });
      });

      describe("Rechercher BDs par mot-clef", function () {
        let résultats: string[];
        let fOublier: schémaFonctionOublier;
        let idMotClef: string;
        let idBdRechercheMotsClefs: string;

        before(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();

          fOublier = await client.bds!.rechercherBdsParMotsClefs({
            motsClefs: [idMotClef],
            f: (r) => (résultats = r),
          });

          idBdRechercheMotsClefs = await client.bds!.créerBd({
            licence: "ODbl-1_0",
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Pas de résultats pour commencer", async () => {
          expect(Array.isArray(résultats)).to.be.true();
          expect(résultats.length).to.equal(0);
        });

        it("Ajout d'un mot-clef détecté", async () => {
          await client.bds!.ajouterMotsClefsBd({
            idBd: idBdRechercheMotsClefs,
            idsMotsClefs: [idMotClef],
          });
          expect(Array.isArray(résultats)).to.be.true();
          expect(résultats.length).to.equal(1);
          expect(résultats[0]).to.equal(idBdRechercheMotsClefs);
        });
      });
    });
  });
});
