import { step } from "mocha-steps";

import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import rmrf from "rimraf";
import AdmZip from "adm-zip";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  adresseOrbiteValide,
  uneFois,
} from "@/utils";
import { InfoColAvecCatégorie } from "@/tableaux";
import { infoScore, schémaSpécificationBd } from "@/bds";
import { élémentBdListeDonnées } from "@/tableaux";
import { élémentDonnées, règleBornes } from "@/valid";

import { générerClients, attendreRésultat, typesClients } from "@/utilsTests";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("BDs", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      let idBd: string;

      beforeAll(async () => {
        enregistrerContrôleurs();
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      });

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      step("Création", async () => {
        idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
        expect(adresseOrbiteValide(idBd)).toBe(true);
      });

      describe("Mes BDs", async () => {
        let fOublier: schémaFonctionOublier;
        let bds: string[];
        let idNouvelleBd: string;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreBds({
            f: (_bds) => (bds = _bds),
          });
        });
        afterAll(async () => {
          if (fOublier) fOublier();
        });
        step("La BD déjà créée est présente", async () => {
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(1);
          expect(bds[0]).toEqual(idBd);
        });
        step("On crée une autre BD sans l'ajouter", async () => {
          idNouvelleBd = await client.bds!.créerBd({
            licence: "ODbl-1_0",
            ajouter: false,
          });
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(1);
          expect(bds[0]).toEqual(idBd);
        });
        step("On peut l'ajouter ensuite à mes bds", async () => {
          await client.bds!.ajouterÀMesBds({ id: idNouvelleBd });
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(2);
          expect(bds).to.include.members([idNouvelleBd, idBd]);
        });
        step("On peut aussi l'effacer", async () => {
          await client.bds!.effacerBd({ id: idNouvelleBd });
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(1);
          expect(bds[0]).toEqual(idBd);
        });
      });

      describe("Noms", function () {
        let noms: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreNomsBd({
            id: idBd,
            f: (n) => (noms = n),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        step("Pas de noms pour commencer", async () => {
          expect(noms).toHaveLength(0);
        });

        step("Ajouter un nom", async () => {
          await client.bds!.sauvegarderNomBd({
            id: idBd,
            langue: "fr",
            nom: "Alphabets",
          });
          expect(noms.fr).toEqual("Alphabets");
        });

        step("Ajouter des noms", async () => {
          await client.bds!.ajouterNomsBd({
            id: idBd,
            noms: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          expect(noms).toEqual({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        step("Changer un nom", async () => {
          await client.bds!.sauvegarderNomBd({
            id: idBd,
            langue: "fr",
            nom: "Systèmes d'écriture",
          });
          expect(noms?.fr).toEqual("Systèmes d'écriture");
        });

        step("Effacer un nom", async () => {
          await client.bds!.effacerNomBd({ id: idBd, langue: "fr" });
          expect(noms).toEqual({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Descriptions", function () {
        let descrs: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreDescrBd({
            id: idBd,
            f: (d) => (descrs = d),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        step("Aucune description pour commencer", async () => {
          expect(descrs).toHaveLength(0);
        });

        step("Ajouter une description", async () => {
          await client.bds!.sauvegarderDescrBd({
            id: idBd,
            langue: "fr",
            descr: "Alphabets",
          });
          expect(descrs.fr).toEqual("Alphabets");
        });

        step("Ajouter des descriptions", async () => {
          await client.bds!.ajouterDescriptionsBd({
            id: idBd,
            descriptions: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          expect(descrs).toEqual({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        step("Changer une description", async () => {
          await client.bds!.sauvegarderDescrBd({
            id: idBd,
            langue: "fr",
            descr: "Systèmes d'écriture",
          });
          expect(descrs?.fr).toEqual("Systèmes d'écriture");
        });

        step("Effacer une description", async () => {
          await client.bds!.effacerDescrBd({ id: idBd, langue: "fr" });
          expect(descrs).toEqual({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Mots-clefs", function () {
        let motsClefs: string[];
        let fOublier: schémaFonctionOublier;
        let idMotClef: string;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreMotsClefsBd({
            id: idBd,
            f: (m) => (motsClefs = m),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });
        step("Pas de mots-clefs pour commencer", async () => {
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });
        step("Ajout d'un mot-clef", async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          await client.bds!.ajouterMotsClefsBd({
            idBd,
            idsMotsClefs: idMotClef,
          });
          expect(isArray(motsClefs)).toBe(true).of.length(1);
        });
        step("Effacer un mot-clef", async () => {
          await client.bds!.effacerMotClefBd({ idBd, idMotClef });
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });
      });

      describe("Changer licence BD", function () {
        let idBd: string;
        let licence: string;
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          fOublier = await client.bds!.suivreLicence({
            id: idBd,
            f: (l) => (licence = l),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        step("Licence originale présente", async () => {
          expect(licence).toEqual("ODbl-1_0");
        });

        step("Changement de licence", async () => {
          await client.bds!.changerLicenceBd({ idBd, licence: "ODC-BY-1_0" });
          expect(licence).toEqual("ODC-BY-1_0");
        });
      });

      describe("Statut BD", function () {
        step("À faire");
      });

      describe("Tableaux", function () {
        let tableaux: string[];
        let fOublier: schémaFonctionOublier;
        let idTableau: string;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreTableauxBd({
            id: idBd,
            f: (t) => (tableaux = t),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        step("Pas de tableaux pour commencer", async () => {
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });

        step("Ajout d'un tableau", async () => {
          idTableau = await client.bds!.ajouterTableauBd({ id: idBd });
          expect(adresseOrbiteValide(idTableau)).toBe(true);
          expect(isArray(motsClefs)).toBe(true).of.length(1);
          expect(tableaux[0]).toEqual(idTableau);
        });

        step("Effacer un tableau", async () => {
          await client.bds!.effacerTableauBd({ id: idBd, idTableau });
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });
      });

      describe("Variables", function () {
        let variables: string[];
        let fOublier: schémaFonctionOublier;
        let idTableau: string;
        let idVariable: string;
        let idColonne: string;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreVariablesBd({
            id: idBd,
            f: (v) => (variables = v),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });
        step("Pas de variables pour commencer", async () => {
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });
        step("Ajout d'un tableau et d'une variable", async () => {
          idTableau = await client.bds!.ajouterTableauBd({ id: idBd });
          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });

          idColonne = await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable,
          });

          expect(isArray(motsClefs)).toBe(true).of.length(1);
          expect(variables[0]).toEqual(idVariable);
        });
        step("Effacer une variable", async () => {
          await client.tableaux!.effacerColonneTableau({
            idTableau,
            idColonne,
          });
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
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
        let tableaux: string[];

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

        beforeAll(async () => {
          idBdOrig = await client.bds!.créerBd({ licence: réfLicence });

          await client.bds!.ajouterNomsBd({ id: idBdOrig, noms: réfNoms });
          await client.bds!.ajouterDescriptionsBd({
            id: idBdOrig,
            descriptions: réfDescrs,
          });

          idMotClef = await client.motsClefs!.créerMotClef();
          await client.bds!.ajouterMotsClefsBd({
            idBd: idBdOrig,
            idsMotsClefs: idMotClef,
          });

          idTableau = await client.bds!.ajouterTableauBd({ id: idBdOrig });

          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable,
          });

          idBdCopie = await client.bds!.copierBd({ id: idBdOrig });

          fsOublier.push(
            await client.bds!.suivreNomsBd({
              id: idBdCopie,
              f: (x) => (noms = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreDescrBd({
              id: idBdCopie,
              f: (x) => (descrs = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreLicence({
              id: idBdCopie,
              f: (x) => (licence = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreMotsClefsBd({
              id: idBdCopie,
              f: (x) => (motsClefs = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreVariablesBd({
              id: idBdCopie,
              f: (x) => (variables = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreTableauxBd({
              id: idBdCopie,
              f: (x) => (tableaux = x),
            })
          );
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        it("Les noms sont copiés", async () => {
          expect(noms).toEqual(réfNoms);
        });
        it("Les descriptions sont copiées", async () => {
          expect(descrs).toEqual(réfDescrs);
        });
        it("La licence est copiée", async () => {
          expect(licence).toEqual(réfLicence);
        });
        it("Les mots-clefs sont copiés", async () => {
          expect(motsClefs).to.have.members([idMotClef]);
        });
        it("Les tableaux sont copiés", async () => {
          expect(isArray(motsClefs)).toBe(true).of.length(1);
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

        beforeAll(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîne",
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
                idUnique: "tableau trads",
              },
            ],
          };

          idBd1 = await client.bds!.créerBdDeSchéma({ schéma });
          idBd2 = await client.bds!.créerBdDeSchéma({ schéma });

          idTableau1 = (
            await uneFois(
              async (
                fSuivi: schémaFonctionSuivi<string[]>
              ): Promise<schémaFonctionOublier> => {
                return await client.bds!.suivreTableauxBd({
                  id: idBd1,
                  f: fSuivi,
                });
              }
            )
          )[0];
          idTableau2 = (
            await uneFois(
              async (
                fSuivi: schémaFonctionSuivi<string[]>
              ): Promise<schémaFonctionOublier> => {
                return await client.bds!.suivreTableauxBd({
                  id: idBd2,
                  f: fSuivi,
                });
              }
            )
          )[0];

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

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        it("Les données sont copiées", async () => {
          const donnéesCombinées = données1.map((d) => d.données);
          const donnéesSansId = donnéesCombinées.map((d) => {
            delete d.id;
            return d;
          });
          expect(isArray(donnéesSansId)).toBe(true);

          expect(donnéesSansId)
            .toHaveLength(3)
            .and.deep.members([
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

        let tableaux: string[];
        let tableauUnique: string | undefined;

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarLangue = await client.variables!.créerVariable({
            catégorie: "chaîne",
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
                idUnique: "tableau trads",
              },
              {
                cols: [
                  {
                    idVariable: idVarLangue,
                    idColonne: "langue",
                    index: true,
                  },
                ],
                idUnique: "tableau langues",
              },
            ],
          };

          idBd = await client.bds!.créerBdDeSchéma({ schéma });
          fsOublier.push(
            await client.bds!.suivreTableauxBd({
              id: idBd,
              f: (t) => (tableaux = t),
            })
          );
          fsOublier.push(
            await client.bds!.suivreTableauParIdUnique({
              idBd,
              idUniqueTableau: "tableau trads",
              f: (t) => (tableauUnique = t),
            })
          );
        });

        afterAll(async () => {
          fsOublier.forEach((f) => f());
        });

        step("Les tableaux sont créés", async () => {
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(2);
        });

        step("Colonnes", async () => {
          const colonnes = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<InfoColAvecCatégorie[]>
            ): Promise<schémaFonctionOublier> => {
              return await client.tableaux!.suivreColonnes({
                idTableau: tableaux[0],
                f: fSuivi,
              });
            }
          );

          const idsColonnes = colonnes.map((c) => c.id);
          expect(isArray(idsColonnes)).toBe(true);

          expect(idsColonnes).toHaveLength(2);
          expect(idsColonnes).toEqual(expect.arrayContaining(["clef", "trad"]));
        });

        step("Mots clefs", async () => {
          const motsClefs = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string[]>
            ): Promise<schémaFonctionOublier> => {
              return await client.bds!.suivreMotsClefsBd({
                id: idBd,
                f: fSuivi,
              });
            }
          );
          expect(isArray(motsClefs)).toBe(true);

          expect(motsClefs).toHaveLength(1);
          expect(motsClefs).toEqual(expect.arrayContaining([idMotClef]));
        });

        step("Index colonne", async () => {
          const indexes = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string[]>
            ): Promise<schémaFonctionOublier> => {
              return await client.tableaux!.suivreIndex({
                idTableau: tableaux[0],
                f: fSuivi,
              });
            }
          );
          expect(isArray(indexes)).toBe(true);

          expect(indexes).toHaveLength(1).and.members(["clef"]);
        });

        step("Tableaux unique détectable", async () => {
          expect(adresseOrbiteValide(tableauUnique)).toBe(true);
        });
      });

      describe("Suivre BD unique", function () {
        let idVarClef: string;
        let idVarTrad: string;
        let idVarLangue: string;

        let fOublier: schémaFonctionOublier;

        const rés: { ultat?: string } = {};

        beforeAll(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarLangue = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });

          const motClefUnique = await client.motsClefs!.créerMotClef();

          const schéma: schémaSpécificationBd = {
            licence: "ODbl-1_0",
            motsClefs: [motClefUnique],
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
                idUnique: "tableau trads",
              },
              {
                cols: [
                  {
                    idVariable: idVarLangue,
                    idColonne: "langue",
                    index: true,
                  },
                ],
                idUnique: "tableau langues",
              },
            ],
          };

          fOublier = await client.bds!.suivreBdUnique({
            schéma,
            motClefUnique,
            f: (id) => (rés.ultat = id),
          });
        });
        afterAll(() => {
          if (fOublier) fOublier();
        });
        it("La BD est créée lorsqu'elle n'existe pas", async () => {
          await attendreRésultat(rés, "ultat");
          expect(adresseOrbiteValide(rés.ultat)).toBe(true);
        });
        it("Gestion de la concurrence entre dispositifs");
        it("Gestion de concurrence entre 2+ BDs");
      });

      describe("Suivre tableau unique", function () {
        let idBd: string;
        let idTableau: string;

        let fOublier: schémaFonctionOublier;

        const rés: { ultat?: string } = {};

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

          idTableau = await client.bds!.ajouterTableauBd({ id: idBd });

          fOublier = await client.bds!.suivreTableauParIdUnique({
            idBd: idBd,
            idUniqueTableau: "clefUnique",
            f: (id) => (rés.ultat = id),
          });
        });

        afterAll(() => {
          if (fOublier) fOublier();
        });
        it("Rien pour commencer", async () => {
          expect(rés.ultat).toBeUndefined;
        });
        it("Ajour d'id unique détecté", async () => {
          await client.tableaux!.spécifierIdUniqueTableau({
            idTableau,
            idUnique: "clefUnique",
          });
          await attendreRésultat(rés, "ultat");
          expect(rés.ultat).toEqual(idTableau);
        });
      });

      describe("Suivre tableau unique de BD unique", function () {
        let idVarClef: string;
        let idVarTrad: string;

        let fOublier: schémaFonctionOublier;

        const rés: { ultat?: string } = {};

        beforeAll(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });

          const motClefUnique = await client.motsClefs!.créerMotClef();

          const schéma: schémaSpécificationBd = {
            licence: "ODbl-1_0",
            motsClefs: [motClefUnique],
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
                idUnique: "id tableau unique",
              },
            ],
          };

          fOublier = await client.bds!.suivreTableauUniqueDeBdUnique({
            schémaBd: schéma,
            motClefUnique,
            idUniqueTableau: "id tableau unique",
            f: (id) => (rés.ultat = id),
          });
        });
        afterAll(() => {
          if (fOublier) fOublier();
        });

        it("Tableau unique détecté", async () => {
          await attendreRésultat(rés, "ultat");
          expect(adresseOrbiteValide(rés.ultat)).toBe(true);
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

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          idTableau = await client.bds!.ajouterTableauBd({ id: idBd });

          idVarNumérique = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVarNumérique2 = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVarChaîne = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });

          fOublier = await client.bds!.suivreScoreBd({
            id: idBd,
            f: (s) => (score = s),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        describe("Score accessibilité", function () {
          step("À faire");
        });

        describe("Score couverture tests", function () {
          step("`undefined` lorsque aucune colonne", async () => {
            expect(score.couverture).toBeUndefined;
          });

          step("Ajout de colonnes", async () => {
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
            expect(score.couverture).toEqual(0);
          });

          step("Ajout de règles", async () => {
            const règleNumérique: règleBornes = {
              typeRègle: "bornes",
              détails: { val: 0, op: ">=" },
            };
            await client.tableaux!.ajouterRègleTableau({
              idTableau,
              idColonne: idColNumérique,
              règle: règleNumérique,
            });
            expect(score.couverture).toEqual(0.5);

            await client.tableaux!.ajouterRègleTableau({
              idTableau,
              idColonne: idColNumérique2,
              règle: règleNumérique,
            });
            expect(score.couverture).toEqual(1);
          });
        });

        describe("Score validité", function () {
          let empreinteÉlément: string;

          step("`undefined` pour commencer", async () => {
            expect(score.valide).toBeUndefined;
          });

          step("Ajout d'éléments", async () => {
            empreinteÉlément = await client.tableaux!.ajouterÉlément({
              idTableau,
              vals: {
                [idColNumérique]: -1,
                [idColNumérique2]: 1,
              },
            });
            expect(score.valide).toEqual(0.5);
            await client.tableaux!.ajouterÉlément({
              idTableau,
              vals: {
                [idColNumérique]: 1,
              },
            });
            expect(score.valide).toEqual(2 / 3);
          });

          step("Correction des éléments", async () => {
            await client.tableaux!.modifierÉlément({
              idTableau,
              vals: { [idColNumérique]: 12 },
              empreintePrécédente: empreinteÉlément,
            });
            expect(score.valide).toEqual(1);
          });
        });

        describe("Score total", function () {
          step("Calcul du score total", async () => {
            const total =
              ((score.accès || 0) +
                (score.couverture || 0) +
                (score.valide || 0)) /
              3;
            expect(score.total).toEqual(total);
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

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

          const idTableau1 = await client.bds!.ajouterTableauBd({ id: idBd });
          const idTableau2 = await client.bds!.ajouterTableauBd({ id: idBd });

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

          const octets = fs.readFileSync(
            path.resolve(path.dirname(""), "tests/_ressources/logo.svg")
          );
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
            await client.bds!.exporterDonnées({ id: idBd, langues: ["fr"] }));
        });

        afterAll(() => {
          rmrf.sync(path.resolve(path.dirname(""), "tests/_ressources/_temp"));
        });

        step("Doc créé avec tous les tableaux", () => {
          expect(doc.SheetNames)
            .to.be.an("array")
            .with.members([nomTableau1, nomTableau2]);
        });
        step("Fichiers SFIP retrouvés de tous les tableaux", () => {
          expect(fichiersSFIP.size).equal(1);
          expect(fichiersSFIP).to.have.deep.keys([{ cid, ext: "svg" }]);
        });

        describe("Exporter document données", async () => {
          const dirZip = path.resolve(
            path.dirname(""),
            "tests",
            "_ressources",
            "_temp",
            "testExporterBd"
          );
          const fichierExtrait = path.resolve(
            path.dirname(""),
            "tests/_temp/testExporterBdExtrait"
          );

          beforeAll(async () => {
            await client.bds!.exporterDocumentDonnées({
              données: { doc, fichiersSFIP, nomFichier },
              formatDoc: "ods",
              dir: dirZip,
              inclureFichierSFIP: true,
            });
          });

          step("Le fichier zip existe", () => {
            const nomZip = path.join(dirZip, nomFichier + ".zip");
            expect(fs.existsSync(nomZip)).toBe(true);
            const zip = new AdmZip(nomZip);
            zip.extractAllTo(fichierExtrait, true);
            expect(fs.existsSync(fichierExtrait)).toBe(true);
          });

          step("Les données sont exportées", () => {
            expect(
              fs.existsSync(path.join(fichierExtrait, nomFichier + ".ods"))
            ).toBe(true);
          });

          step("Le dossier pour les données SFIP existe", () => {
            expect(fs.existsSync(path.join(fichierExtrait, "sfip"))).to.be.true;
          });

          step("Les fichiers SFIP existent", () => {
            expect(
              fs.existsSync(path.join(fichierExtrait, "sfip", cid + ".svg"))
            ).toBe(true);
          });
        });
      });

      describe("Rechercher BDs par mot-clef", function () {
        let résultats: string[];
        let fOublier: schémaFonctionOublier;
        let idMotClef: string;
        let idBdRechercheMotsClefs: string;

        beforeAll(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();

          fOublier = await client.bds!.rechercherBdsParMotsClefs({
            motsClefs: [idMotClef],
            f: (r) => (résultats = r),
          });

          idBdRechercheMotsClefs = await client.bds!.créerBd({
            licence: "ODbl-1_0",
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        step("Pas de résultats pour commencer", async () => {
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });

        step("Ajout d'un mot-clef détecté", async () => {
          await client.bds!.ajouterMotsClefsBd({
            idBd: idBdRechercheMotsClefs,
            idsMotsClefs: [idMotClef],
          });
          expect(isArray(résultats)).toBe(true).of.length(1);
          expect(résultats[0]).toEqual(idBdRechercheMotsClefs);
        });
      });
    });
  });
});
