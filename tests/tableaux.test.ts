import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

chai.should();
chai.use(chaiAsPromised);

import XLSX from "xlsx";
import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation, {
  schémaFonctionOublier,
  adresseOrbiteValide,
  élémentsBd,
} from "@/client";

import { InfoCol, InfoColAvecCatégorie } from "@/tableaux";
import {
  règleVariableAvecId,
  règleBornes,
  règleColonne,
  règleValeurCatégorique,
  erreurValidation,
  élémentDonnées,
  élémentBdListeDonnées,
} from "@/valid";

import { testAPIs, config } from "./sfipTest";
import { générerClients, attendreRésultat, typesClients } from "./utils";


typesClients.forEach((type)=>{
  describe("Client " + type, function() {
    Object.keys(testAPIs).forEach((API) => {
      describe("Tableaux", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

        let idTableau: string;
        let colonnes: InfoColAvecCatégorie[];

        before(async () => {
          enregistrerContrôleurs();
          ({ fOublier: fOublierClients, clients } = await générerClients(1, API, type));
          client = clients[0];
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
        });

        step("Création", async () => {
          idTableau = await client.tableaux!.créerTableau();
          expect(adresseOrbiteValide(idTableau)).to.be.true;
        });

        describe("Noms", function () {
          let noms: { [key: string]: string };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.tableaux!.suivreNomsTableau(
              idTableau,
              (n) => (noms = n)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Pas de noms pour commencer", async () => {
            expect(noms).to.be.empty;
          });

          step("Ajouter un nom", async () => {
            await client.tableaux!.sauvegarderNomTableau(
              idTableau,
              "fr",
              "Alphabets"
            );
            expect(noms.fr).to.equal("Alphabets");
          });

          step("Ajouter des noms", async () => {
            await client.tableaux!.ajouterNomsTableau(idTableau, {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            });
            expect(noms).to.deep.equal({
              fr: "Alphabets",
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            });
          });

          step("Changer un nom", async () => {
            await client.tableaux!.sauvegarderNomTableau(
              idTableau,
              "fr",
              "Systèmes d'écriture"
            );
            expect(noms?.fr).to.equal("Systèmes d'écriture");
          });

          step("Effacer un nom", async () => {
            await client.tableaux!.effacerNomTableau(idTableau, "fr");
            expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
          });
        });

        describe("Ids uniques", function () {
          let idUnique: string | undefined;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.tableaux!.suivreIdUnique(
              idTableau,
              (id) => (idUnique = id)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Pas de noms pour commencer", async () => {
            expect(idUnique).to.be.undefined;
          });

          step("Ajouter une id unique", async () => {
            await client.tableaux!.spécifierIdUniqueTableau(
              idTableau,
              "quelque chose d'unique"
            );
            expect(idUnique).to.equal("quelque chose d'unique");
          });
        });

        describe("Données", function () {
          let variables: string[];
          let données: élémentDonnées<élémentBdListeDonnées>[];
          let idsVariables: string[];

          const idsColonnes: string[] = [];
          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idTableau = await client.tableaux!.créerTableau();
            fsOublier.push(
              await client.tableaux!.suivreColonnes(
                idTableau,
                (c) => (colonnes = c)
              )
            );
            fsOublier.push(
              await client.tableaux!.suivreVariables(
                idTableau,
                (v) => (variables = v)
              )
            );
            fsOublier.push(
              await client.tableaux!.suivreDonnées(idTableau, (d) => (données = d))
            );

            const idVariable1 = await client.variables!.créerVariable("numérique");
            const idVariable2 = await client.variables!.créerVariable("chaîne");
            idsVariables = [idVariable1, idVariable2];
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Tout est vide pour commencer", async () => {
            expect(variables, "variables").to.exist.and.to.be.an.empty("array");
            expect(colonnes, "colonnes").to.exist.and.to.be.an.empty("array");
            expect(données, "données").to.exist.and.to.be.an.empty("array");
          });

          step("Ajouter colonnes", async () => {
            for (const idV of idsVariables) {
              idsColonnes.push(
                await client.tableaux!.ajouterColonneTableau(idTableau, idV)
              );
            }
            expect(colonnes.map((c) => c.variable)).to.have.deep.members(
              idsVariables
            );
          });

          step("Les variables sont détectées", async () => {
            expect(variables).to.have.deep.members(idsVariables);
          });

          step("Ajouter un élément", async () => {
            const élément = {
              [idsColonnes[0]]: 123.456,
              [idsColonnes[1]]: "வணக்கம்",
            };
            await client.tableaux!.ajouterÉlément(idTableau, élément);
            expect(données).to.be.an("array").with.lengthOf(1);

            const élémentDonnées = données[0];
            expect(élémentDonnées.empreinte).to.be.a("string");
            for (const [cl, v] of Object.entries(élément)) {
              expect(élémentDonnées.données[cl]).to.exist.and.to.equal(v);
            }
          });

          step("Modifier un élément - modifier une valeur", async () => {
            const élémentDonnées = données[0];

            await client.tableaux!.modifierÉlément(
              idTableau,
              { [idsColonnes[0]]: -123 },
              élémentDonnées.empreinte
            );
            expect(données).to.be.an("array").with.lengthOf(1);

            const nouvelÉlémentDonnées = données[0];
            expect(nouvelÉlémentDonnées.données[idsColonnes[0]]).to.equal(-123);
          });

          step("Modifier un élément - effacer une clef", async () => {
            const élémentDonnées = données[0];

            await client.tableaux!.modifierÉlément(
              idTableau,
              { [idsColonnes[0]]: undefined },
              élémentDonnées.empreinte
            );

            const nouvelÉlémentDonnées = données[0];
            expect(nouvelÉlémentDonnées.données).to.not.have.key(idsColonnes[0]);
          });

          step("Modifier un élément - ajouter une clef", async () => {
            const élémentDonnées = données[0];

            await client.tableaux!.modifierÉlément(
              idTableau,
              { [idsColonnes[0]]: 123 },
              élémentDonnées.empreinte
            );

            const nouvelÉlémentDonnées = données[0];
            expect(nouvelÉlémentDonnées.données[idsColonnes[0]]).to.equal(123);
          });

          step("Effacer un élément", async () => {
            const élémentDonnées = données[0];

            await client.tableaux!.effacerÉlément(
              idTableau,
              élémentDonnées.empreinte
            );
            expect(données).to.be.an.empty("array");
          });

          step("Effacer une colonne", async () => {
            await client.tableaux!.effacerColonneTableau(idTableau, idsColonnes[0]);
            expect(colonnes.map((c) => c.variable))
              .have.lengthOf(1)
              .and.to.have.members([idsVariables[1]]);
          });
        });

        describe("Colonnes index", function () {
          let indexes: string[];
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.tableaux!.suivreIndex(
              idTableau,
              (x) => (indexes = x)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Pas d'index pour commencer", async () => {
            expect(indexes).to.be.an.empty("array");
          });

          step("Ajouter un index", async () => {
            await client.tableaux!.changerColIndex(
              idTableau,
              colonnes[0].id,
              true
            );
            expect(indexes)
              .to.have.lengthOf(1)
              .and.to.have.members([colonnes[0].id]);
          });

          step("Effacer l'index", async () => {
            await client.tableaux!.changerColIndex(
              idTableau,
              colonnes[0].id,
              false
            );
            expect(indexes).to.be.an.empty("array");
          });
        });

        describe("Règles: Fonctionnalités de base", function () {
          let idTableauRègles: string;
          let idVariableNumérique: string;
          let idVariableChaîne: string;

          let idRègle: string;

          let idColonneNumérique: string;
          let idColonneChaîne: string;

          const résultats: { règles: règleColonne[]; erreurs: erreurValidation[] } =
            { règles: [], erreurs: [] };
          const fsOublier: schémaFonctionOublier[] = [];

          beforeEach(async () => {
            idTableauRègles = await client.tableaux!.créerTableau();
            fsOublier.push(
              await client.tableaux!.suivreRègles(
                idTableauRègles,
                (r) => (résultats.règles = r)
              )
            );
            fsOublier.push(
              await client.tableaux!.suivreValidDonnées(
                idTableauRègles,
                (e) => (résultats.erreurs = e)
              )
            );

            idVariableNumérique = await client.variables!.créerVariable(
              "numérique"
            );
            idVariableChaîne = await client.variables!.créerVariable("chaîne");

            idColonneNumérique = await client.tableaux!.ajouterColonneTableau(
              idTableauRègles,
              idVariableNumérique
            );
            idColonneChaîne = await client.tableaux!.ajouterColonneTableau(
              idTableauRègles,
              idVariableChaîne
            );
          });

          afterEach(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Règles génériques de catégorie pour commencer", async () => {
            await attendreRésultat(
              résultats,
              "règles",
              (r: règleColonne[]) => r.length === 2
            );

            expect(résultats.règles).to.be.an("array").with.lengthOf(2);
            for (const r of résultats.règles) {
              expect(r.règle.règle.typeRègle).to.equal("catégorie");
            }
          });

          step("Aucune erreur pour commencer", async () => {
            expect(résultats.erreurs).to.be.an.empty("array");
          });

          step("Ajouter des données valides", async () => {
            await client.tableaux!.ajouterÉlément(idTableauRègles, {
              [idColonneChaîne]: "abc",
              [idColonneNumérique]: 123,
            });
            expect(résultats.erreurs).to.be.an.empty("array");
          });

          step("Ajouter des données de catégorie invalide", async () => {
            const empreinte = await client.tableaux!.ajouterÉlément(
              idTableauRègles,
              {
                [idColonneChaîne]: 123,
              }
            );

            expect(empreinte).to.be.a.string;
            expect(résultats.erreurs).to.be.an("array").with.lengthOf(1);
            expect(
              résultats.erreurs[0].erreur.règle.règle.règle.typeRègle
            ).to.equal("catégorie");
          });

          step("Ajouter une règle au tableau", async () => {
            const règle: règleBornes = {
              typeRègle: "bornes",
              détails: {
                val: 0,
                op: "<",
              },
            };
            idRègle = await client.tableaux!.ajouterRègleTableau(
              idTableauRègles,
              idColonneNumérique,
              règle
            );
            expect(résultats.règles).to.have.lengthOf(3);
            const règleAjoutée = résultats.règles.filter(
              (r) => r.règle.id === idRègle
            )[0];
            expect(règleAjoutée).to.exist;
            expect(règleAjoutée.source).to.equal("tableau");
          });

          step("Ajouter une règle à la variable", async () => {
            const règle: règleBornes = {
              typeRègle: "bornes",
              détails: {
                val: 0,
                op: "<",
              },
            };
            idRègle = await client.variables!.ajouterRègleVariable(
              idVariableNumérique,
              règle
            );
            expect(résultats.règles).to.have.lengthOf(3);
            expect(
              résultats.règles.filter((r) => r.règle.id === idRègle)
            ).to.have.lengthOf(1);
          });

          step("Ajouter des données invalides (règle tableau)", async () => {
            const règle: règleBornes = {
              typeRègle: "bornes",
              détails: {
                val: 0,
                op: "<",
              },
            };
            idRègle = await client.tableaux!.ajouterRègleTableau(
              idTableauRègles,
              idColonneNumérique,
              règle
            );

            await client.tableaux!.ajouterÉlément(idTableauRègles, {
              [idColonneNumérique]: 123,
            });
            expect(résultats.erreurs).to.have.lengthOf(1);
            expect(résultats.erreurs[0].erreur.règle.règle.id).to.equal(idRègle);
          });

          step("Ajouter des données invalides (règle variable)", async () => {
            const règle: règleBornes = {
              typeRègle: "bornes",
              détails: {
                val: 0,
                op: "<",
              },
            };
            idRègle = await client.variables!.ajouterRègleVariable(
              idVariableNumérique,
              règle
            );

            await client.tableaux!.ajouterÉlément(idTableauRègles, {
              [idColonneNumérique]: 123,
            });
            expect(résultats.erreurs).to.have.lengthOf(1);
            expect(résultats.erreurs[0].erreur.règle.règle.id).to.equal(idRègle);
          });

          step(
            "On ne peut pas directement effacer une règle provenant de la variable",
            async () => {
              const règle: règleBornes = {
                typeRègle: "bornes",
                détails: {
                  val: 0,
                  op: "<",
                },
              };
              idRègle = await client.variables!.ajouterRègleVariable(
                idVariableNumérique,
                règle
              );
              await client.tableaux!.effacerRègleTableau(idTableauRègles, idRègle);
              expect(
                résultats.règles.filter((r) => r.règle.id === idRègle)
              ).to.have.lengthOf(1);
            }
          );

          step("Effacer une règle tableau", async () => {
            const règle: règleBornes = {
              typeRègle: "bornes",
              détails: {
                val: 0,
                op: "<",
              },
            };
            idRègle = await client.tableaux!.ajouterRègleTableau(
              idTableauRègles,
              idColonneNumérique,
              règle
            );
            await client.tableaux!.ajouterÉlément(idTableauRègles, {
              [idColonneNumérique]: 123,
            });

            await client.tableaux!.effacerRègleTableau(idTableauRègles, idRègle);
            expect(résultats.règles).to.have.lengthOf(2);
            expect(résultats.erreurs).to.have.lengthOf(0);
          });

          step("Effacer une règle variable", async () => {
            const règle: règleBornes = {
              typeRègle: "bornes",
              détails: {
                val: 0,
                op: "<",
              },
            };
            idRègle = await client.variables!.ajouterRègleVariable(
              idVariableNumérique,
              règle
            );
            await client.tableaux!.ajouterÉlément(idTableauRègles, {
              [idColonneNumérique]: 123,
            });

            expect(résultats.règles).to.have.lengthOf(3);
            expect(résultats.erreurs).to.have.lengthOf(1);

            await client.variables!.effacerRègleVariable(
              idVariableNumérique,
              idRègle
            );

            expect(résultats.règles).to.have.lengthOf(2);
            expect(résultats.erreurs).to.have.lengthOf(0);
          });
        });

        describe("Règles: Règle bornes relative à une colonne", function () {
          let règles: règleColonne[];
          let erreurs: erreurValidation[];
          let idTableauRègles: string;

          let idVariableTempMin: string;
          let idColonneTempMin: string;
          let idVariableTempMax: string;

          const idColonneTempMax = "col temp max";
          const fsOublier: schémaFonctionOublier[] = [];

          beforeEach(async () => {
            idTableauRègles = await client.tableaux!.créerTableau();
            fsOublier.push(
              await client.tableaux!.suivreRègles(
                idTableauRègles,
                (r) => (règles = r)
              )
            );
            fsOublier.push(
              await client.tableaux!.suivreValidDonnées(
                idTableauRègles,
                (e) => (erreurs = e)
              )
            );

            idVariableTempMin = await client.variables!.créerVariable("numérique");
            idVariableTempMax = await client.variables!.créerVariable("numérique");

            idColonneTempMin = await client.tableaux!.ajouterColonneTableau(
              idTableauRègles,
              idVariableTempMin
            );
          });

          afterEach(async () => {
            fsOublier.forEach((f) => f());
          });

          step("Erreur si la colonne n'existe pas", async () => {
            const règle: règleBornes = {
              typeRègle: "bornes",
              détails: {
                val: idColonneTempMax,
                op: "<=",
              },
            };
            await client.tableaux!.ajouterRègleTableau(
              idTableauRègles,
              idColonneTempMin,
              règle
            );
            expect(erreurs).to.be.an("array").of.length(1)
            console.log({erreurs})
          });
          step("Ajout colonne réf détectée", async () => {
            await client.tableaux!.ajouterColonneTableau(
              idTableauRègles,
              idVariableTempMax,
              idColonneTempMax
            );
            
          });
          step("Ajout éléments colonne réf détecté");
          step("Ajout éléments valides");
          step("Ajout éléments invalides");
        });

        describe("Règle valeur catégorique", function () {
          describe("Dans le même tableau", function () {
            it("Erreur si colonne n'existe pas");
            it("Ajout colonne réf détectée");
            it("Ajout éléments colonne réf détecté");
            it("Ajout éléments valides");
            it("Ajout éléments invalides");
          });
          describe("Inter-tableau", function () {
            it("Erreur si tableau n'existe pas");
            it("Erreur si colonne n'existe pas");
            it("Ajout colonne réf détectée");
            it("Ajout éléments colonne réf détectée");
            it("Ajout éléments valides");
            it("Ajout éléments invalides");
          });
        });

        describe("Tableau avec variables non locales", function () {
          let idTableau: string;
          let idColonne: string;
          let variables: string[];
          let colonnes: InfoColAvecCatégorie[];
          let colonnesSansCatégorie: InfoCol[];
          let données: élémentDonnées[];

          const idVarChaîne = "/orbitdb/zdpuAximNmZyUWXGCaLmwSEGDeWmuqfgaoogA7KNSa1B2DAAF/dd77aec3-e7b8-4695-b068-49ce4227b360"
          const fsOublier: schémaFonctionOublier[] = []

          before(async () => {

            idTableau = await client.tableaux!.créerTableau();
            idColonne = await client.tableaux!.ajouterColonneTableau(
              idTableau, idVarChaîne
            );
            fsOublier.push(
              await client.tableaux!.suivreVariables(
                idTableau, v=>variables = v
              )
            )
            fsOublier.push(
              await client.tableaux!.suivreColonnes(
                idTableau, c=>colonnes=c
              )
            )
            fsOublier.push(
              await client.tableaux!.suivreColonnes(
                idTableau, c=>colonnesSansCatégorie=c, false
              )
            )
            fsOublier.push(
              await client.tableaux!.suivreDonnées(
                idTableau, d=>données=d
              )
            )
          });

          after(()=>{
            fsOublier.forEach(f=>f());
          })
          step("Tableau créé", () => {
            expect(adresseOrbiteValide(idTableau)).to.be.true;
          });
          step("Suivre variables", () => {
            expect(variables).to.be.an("array").with.lengthOf(1).and.members([idVarChaîne])
          });
          step("Suivre colonnes", () => {
            expect(colonnes).to.be.undefined;
          })
          step("Suivre colonnes sans catégorie", () => {
            expect(colonnesSansCatégorie).to.be.an("array").with.lengthOf(1)
              .and.deep.members([{id: idColonne, variable: idVarChaîne}])
          })
          step("Ajouter données", async () => {
            await client.tableaux!.ajouterÉlément(
              idTableau, {[idColonne]: "Bonjour !"}
            );
            expect(données).to.be.an("array").with.lengthOf(1)
            expect(données[0].données[idColonne]).to.equal("Bonjour !");
          });

        })

        describe("Copier tableau", function () {
          let idTableau: string;
          let idVariable: string;
          let idColonne: string;
          let idRègle: string;
          let colsIndexe: string[];

          let variables: string[];
          let noms: { [key: string]: string };
          let données: élémentDonnées<élémentBdListeDonnées>[];
          let colonnes: InfoColAvecCatégorie[];
          let règles: règleColonne[];

          const réfNoms = {
            த: "மழை",
            हिं: "बारिश",
          };
          const règle: règleBornes = {
            typeRègle: "bornes",
            détails: {
              val: 0,
              op: ">",
            },
          };

          let idTableauCopie: string;

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idTableau = await client.tableaux!.créerTableau();
            await client.tableaux!.ajouterNomsTableau(idTableau, réfNoms);

            idVariable = await client.variables!.créerVariable("numérique");
            idColonne = await client.tableaux!.ajouterColonneTableau(
              idTableau,
              idVariable
            );
            await client.tableaux!.changerColIndex(idTableau, idColonne, true);

            await client.tableaux!.ajouterÉlément(idTableau, { [idColonne]: 123 });

            idRègle = await client.tableaux!.ajouterRègleTableau(
              idTableau,
              idColonne,
              règle
            );

            idTableauCopie = await client.tableaux!.copierTableau(idTableau);

            fsOublier.push(
              await client.tableaux!.suivreVariables(
                idTableauCopie,
                (x) => (variables = x)
              )
            );
            fsOublier.push(
              await client.tableaux!.suivreNomsTableau(
                idTableauCopie,
                (x) => (noms = x)
              )
            );
            fsOublier.push(
              await client.tableaux!.suivreDonnées(
                idTableauCopie,
                (x) => (données = x)
              )
            );
            fsOublier.push(
              await client.tableaux!.suivreColonnes(
                idTableauCopie,
                (x) => (colonnes = x)
              )
            );
            fsOublier.push(
              await client.tableaux!.suivreIndex(
                idTableauCopie,
                (x) => (colsIndexe = x)
              )
            );
            fsOublier.push(
              await client.tableaux!.suivreRègles(
                idTableauCopie,
                (x) => (règles = x)
              )
            );
          });

          after(async () => {
            fsOublier.forEach((f) => f());
          });

          it("Le tableau est copié", async () => {
            expect(adresseOrbiteValide(idTableauCopie)).to.be.true;
          });

          it("Les noms sont copiés", async () => {
            expect(noms).to.deep.equal(réfNoms);
          });

          it("Les colonnes sont copiées", async () => {
            expect(colonnes).to.be.an("array").with.lengthOf(1);
            expect(colonnes[0].variable).to.equal(idVariable);
          });

          it("Les indexes sont copiés", async () => {
            expect(colsIndexe).to.be.an("array").with.lengthOf(1);
            expect(colsIndexe[0]).to.equal(idColonne);
          });

          it("Les règles sont copiés", async () => {
            const règleRecherchée = règles.find((r) => r.règle.id === idRègle);
            expect(règleRecherchée).to.exist;
            expect(règleRecherchée?.colonne).to.equal(colonnes[0].id);
            expect(règleRecherchée?.règle.règle).to.deep.equal(règle);
          });

          it("Les variables sont copiés", async () => {
            expect(variables).to.be.an("array").with.lengthOf(1);
            expect(variables[0]).to.equal(idVariable);
          });

          it("Les données sont copiés", async () => {
            expect(données).to.be.an("array").with.lengthOf(1);
            expect(données[0].données[colonnes[0].id]).to.equal(123);
          });
        });

        describe("Combiner données tableaux", function () {
          let idTableauBase: string;
          let idTableau2: string;

          let idVarDate: string;
          let idVarEndroit: string;
          let idVarTempMin: string;
          let idVarTempMax: string;

          let données: élémentDonnées<élémentBdListeDonnées>[];
          let fOublier: schémaFonctionOublier;

          const idsCols: { [key: string]: string } = {};

          before(async () => {
            idTableauBase = await client.tableaux!.créerTableau();
            idTableau2 = await client.tableaux!.créerTableau();

            idVarDate = await client.variables!.créerVariable("horoDatage");
            idVarEndroit = await client.variables!.créerVariable("chaîne");
            idVarTempMin = await client.variables!.créerVariable("numérique");
            idVarTempMax = await client.variables!.créerVariable("numérique");

            for (const idVar of [
              idVarDate,
              idVarEndroit,
              idVarTempMin,
              idVarTempMax,
            ]) {
              const idCol = await client.tableaux!.ajouterColonneTableau(
                idTableauBase,
                idVar
              );

              idsCols[idVar] = idCol;
              await client.tableaux!.ajouterColonneTableau(
                idTableau2,
                idVar,
                idCol
              );
            }
            for (const idVar of [idVarDate, idVarEndroit]) {
              await client.tableaux!.changerColIndex(
                idTableauBase,
                idsCols[idVar],
                true
              );
              await client.tableaux!.changerColIndex(
                idTableau2,
                idsCols[idVar],
                true
              );
            }

            fOublier = await client.tableaux!.suivreDonnées(
              idTableauBase,
              (d) => (données = d)
            );

            const élémentsBase = [
              {
                [idsCols[idVarEndroit]]: "ici",
                [idsCols[idVarDate]]: "2021-01-01",
                [idsCols[idVarTempMin]]: 25,
              },
              {
                [idsCols[idVarEndroit]]: "ici",
                [idsCols[idVarDate]]: "2021-01-02",
                [idsCols[idVarTempMin]]: 25,
              },
              {
                [idsCols[idVarEndroit]]: "là-bas",
                [idsCols[idVarDate]]: "2021-01-01",
                [idsCols[idVarTempMin]]: 25,
              },
            ];
            for (const élément of élémentsBase) {
              await client.tableaux!.ajouterÉlément(idTableauBase, élément);
            }

            const éléments2 = [
              {
                [idsCols[idVarEndroit]]: "ici",
                [idsCols[idVarDate]]: "2021-01-01",
                [idsCols[idVarTempMin]]: 27,
                [idsCols[idVarTempMax]]: 30,
              },
              {
                [idsCols[idVarEndroit]]: "ici",
                [idsCols[idVarDate]]: "2021-01-02",
                [idsCols[idVarTempMin]]: 27,
              },
              {
                [idsCols[idVarEndroit]]: "là-bas",
                [idsCols[idVarDate]]: "2021-01-02",
                [idsCols[idVarTempMin]]: 27,
              },
            ];
            for (const élément of éléments2) {
              await client.tableaux!.ajouterÉlément(idTableau2, élément);
            }

            await client.tableaux!.combinerDonnées(idTableauBase, idTableau2);
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Données manquantes ajoutées", async () => {
            expect(données).to.be.an("array").with.lengthOf(4);
            expect(
              données
                .map((d) => d.données)
                .map((d) => {
                  delete d["id"];
                  return d;
                })
            ).to.have.deep.members([
              {
                [idsCols[idVarEndroit]]: "ici",
                [idsCols[idVarDate]]: "2021-01-01",
                [idsCols[idVarTempMin]]: 25,
                [idsCols[idVarTempMax]]: 30,
              },
              {
                [idsCols[idVarEndroit]]: "ici",
                [idsCols[idVarDate]]: "2021-01-02",
                [idsCols[idVarTempMin]]: 25,
              },
              {
                [idsCols[idVarEndroit]]: "là-bas",
                [idsCols[idVarDate]]: "2021-01-01",
                [idsCols[idVarTempMin]]: 25,
              },
              {
                [idsCols[idVarEndroit]]: "là-bas",
                [idsCols[idVarDate]]: "2021-01-02",
                [idsCols[idVarTempMin]]: 27,
              },
            ]);
          });
        });

        describe("Exporter données", function () {
          let idTableau: string;
          let idVarNumérique: string;
          let idVarChaîne: string;
          let idVarFichier: string;
          let idVarBooléenne: string;

          let idColNumérique: string;
          let idColChaîne: string;
          let idColFichier: string;
          let idColBooléenne: string;

          let doc: XLSX.WorkBook;
          let fichiersSFIP: Set<{ cid: string; ext: string }>;

          let fOublier: schémaFonctionOublier;

          const nomTableauFr = "Tableau test";

          before(async () => {
            idTableau = await client.tableaux!.créerTableau();
            idVarNumérique = await client.variables!.créerVariable("numérique");
            idVarChaîne = await client.variables!.créerVariable("chaîne");
            idVarFichier = await client.variables!.créerVariable("fichier");
            idVarBooléenne = await client.variables!.créerVariable("booléen");

            idColNumérique = await client.tableaux!.ajouterColonneTableau(
              idTableau,
              idVarNumérique
            );
            idColChaîne = await client.tableaux!.ajouterColonneTableau(
              idTableau,
              idVarChaîne
            );
            idColBooléenne = await client.tableaux!.ajouterColonneTableau(
              idTableau,
              idVarBooléenne
            );
            idColFichier = await client.tableaux!.ajouterColonneTableau(
              idTableau,
              idVarFichier
            );

            await client.tableaux!.ajouterNomsTableau(idTableau, {
              fr: nomTableauFr,
            });

            await client.variables!.ajouterNomsVariable(idVarNumérique, {
              fr: "Numérique",
              हिं: "यह है संख्या",
            });

            await client.variables!.ajouterNomsVariable(idVarChaîne, {
              fr: "Numérique",
              த: "இது உரை ஆகும்",
            });

            const éléments: { [key: string]: élémentsBd }[] = [
              {
                [idColNumérique]: 123,
                [idColChaîne]: "வணக்கம்",
                [idColBooléenne]: true,
                [idColFichier]: {
                  cid: "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ",
                  ext: "mp4",
                },
              },
              {
                [idColNumérique]: 456,
              },
            ];
            for (const élément of éléments) {
              await client.tableaux!.ajouterÉlément(idTableau, élément);
            }
            ({ doc, fichiersSFIP } = await client.tableaux!.exporterDonnées(
              idTableau,
              ["த", "fr"]
            ));
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          it("Langue appropriée pour le nom du tableau", () => {
            expect(doc.SheetNames[0]).to.equal(nomTableauFr);
          });

          it("Langue appropriée pour les noms des colonnes", () => {
            for (const { cellule, val } of [
              { cellule: "A1", val: "Numérique" },
              { cellule: "B1", val: "இது உரை ஆகும்" },
              { cellule: "C1", val: idColBooléenne },
              { cellule: "D1", val: idColFichier },
            ]) {
              expect(
                (doc.Sheets[nomTableauFr][cellule] as XLSX.CellObject).v
              ).to.equal(val);
            }
          });

          it("Données numériques exportées", async () => {
            const val = doc.Sheets[nomTableauFr]["A2"].v;
            expect(val).to.equal(123);

            const val2 = doc.Sheets[nomTableauFr]["A3"].v;
            expect(val2).to.equal(456);
          });

          it("Données chaîne exportées", async () => {
            const val = doc.Sheets[nomTableauFr]["B2"].v;
            expect(val).to.equal("வணக்கம்");
          });

          it("Données booléennes exportées", async () => {
            const val = doc.Sheets[nomTableauFr]["C2"].v;
            expect(val).to.equal("true");
          });

          it("Données fichier exportées", async () => {
            const val = doc.Sheets[nomTableauFr]["D2"].v;
            expect(val).to.equal(
              "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ.mp4"
            );
          });

          it("Les fichiers SFIP sont détectés", async () => {
            expect(fichiersSFIP.size).equal(1);
            expect(fichiersSFIP).to.have.deep.keys([
              { cid: "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ", ext: "mp4" },
            ]);
          });

          it("Exporter avec ids des colonnes et du tableau", async () => {
            ({ doc } = await client.tableaux!.exporterDonnées(idTableau));
            const idTableauCourt = idTableau.split("/").pop()!.slice(0, 30);
            expect(doc.SheetNames[0]).to.equal(idTableauCourt);
            for (const { cellule, val } of [
              { cellule: "A1", val: idColNumérique },
              { cellule: "B1", val: idColChaîne },
              { cellule: "C1", val: idColBooléenne },
              { cellule: "D1", val: idColFichier },
            ]) {
              expect(
                (doc.Sheets[idTableauCourt][cellule] as XLSX.CellObject).v
              ).to.equal(val);
            }
          });
        });
      });
    });
  });
});
