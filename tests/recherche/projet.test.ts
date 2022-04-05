import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
  infoRésultatRecherche,
} from "@/utils";
import {
  rechercherProjetSelonNom,
  rechercherProjetSelonDescr,
  rechercherProjetSelonIdBd,
  rechercherProjetSelonBd,
  rechercherProjetSelonIdMotClef,
  rechercherProjetSelonNomMotClef,
  rechercherProjetSelonMotClef,
  rechercherProjetSelonIdVariable,
  rechercherProjetSelonNomVariable,
  rechercherProjetSelonVariable,
  rechercherProjetSelonTexte,
} from "@/recherche/projet";

import { testAPIs, config } from "../sfipTest";
import { générerClients, typesClients } from "../utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Rechercher projets", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

        before(async () => {
          enregistrerContrôleurs();
          ({ fOublier: fOublierClients, clients } = await générerClients(
            1,
            API,
            type
          ));
          client = clients[0];
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("Selon nom", function () {
          let idProjet: string;
          let résultat:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idProjet = await client.projets!.créerProjet();

            const fRecherche = rechercherProjetSelonNom("Météo");
            fOublier = await fRecherche(
              client,
              idProjet,
              (r) => (résultat = r)
            );
          });

          after(() => {
            if (fOublier) fOublier();
          });

          step("Pas de résultat quand le projet n'a pas de nom", async () => {
            expect(résultat).to.be.undefined;
          });

          step("Ajout nom détecté", async () => {
            await client.projets!.ajouterNomsProjet(idProjet, {
              fr: "Météorologie",
            });

            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "nom",
              info: {
                type: "texte",
                début: 0,
                fin: 5,
                texte: "Météorologie",
              },
              score: 1,
            });
          });
        });

        describe("Selon description", function () {
          let idProjet: string;
          let résultat:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idProjet = await client.projets!.créerProjet();

            const fRecherche = rechercherProjetSelonDescr("Météo");
            fOublier = await fRecherche(
              client,
              idProjet,
              (r) => (résultat = r)
            );
          });

          after(() => {
            if (fOublier) fOublier();
          });

          step(
            "Pas de résultat quand le projet n'a pas de description",
            async () => {
              expect(résultat).to.be.undefined;
            }
          );

          step("Ajout description détecté", async () => {
            await client.projets!.ajouterDescriptionsProjet(idProjet, {
              fr: "Météo historique",
            });

            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "descr",
              info: {
                type: "texte",
                début: 0,
                fin: 5,
                texte: "Météo historique",
              },
              score: 1,
            });
          });
        });

        describe("Selon mot-clef", function () {
          let idProjet: string;
          let idMotClef: string;
          let résultatNom:
            | résultatObjectifRecherche<
                infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;
          let résultatId:
            | résultatObjectifRecherche<
                infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;
          let résultatTous:
            | résultatObjectifRecherche<
                infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idProjet = await client.projets!.créerProjet();
            idMotClef = await client.motsClefs!.créerMotClef();

            const fRechercheNom = rechercherProjetSelonNomMotClef("Météo");
            fsOublier.push(
              await fRechercheNom(client, idProjet, (r) => (résultatNom = r))
            );

            const fRechercheId = rechercherProjetSelonIdMotClef(
              idMotClef.slice(0, 15)
            );
            fsOublier.push(
              await fRechercheId(client, idProjet, (r) => (résultatId = r))
            );

            const fRechercheTous = rechercherProjetSelonMotClef("Météo");
            fsOublier.push(
              await fRechercheTous(client, idProjet, (r) => (résultatTous = r))
            );
          });

          after(() => {
            fsOublier.forEach((f) => f());
          });

          step(
            "Pas de résultat quand le projet n'a pas de mot-clef",
            async () => {
              expect(résultatId).to.be.undefined;
              expect(résultatNom).to.be.undefined;
              expect(résultatTous).to.be.undefined;
            }
          );

          step("Ajout mot-clef détecté", async () => {
            await client.projets!.ajouterMotsClefsProjet(idProjet, idMotClef);

            const réfRésId: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              type: "résultat",
              clef: idMotClef,
              de: "motClef",
              info: {
                type: "résultat",
                de: "id",
                info: {
                  type: "texte",
                  début: 0,
                  fin: 15,
                  texte: idMotClef,
                },
              },
              score: 1,
            };

            expect(résultatId).to.deep.equal(réfRésId);
          });

          step("Ajout nom mot-clef détecté", async () => {
            await client.motsClefs!.ajouterNomsMotClef(idMotClef, {
              fr: "Météo historique pour la région de Montréal",
            });

            const réfRésNom: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              type: "résultat",
              clef: idMotClef,
              de: "motClef",
              info: {
                type: "résultat",
                de: "nom",
                clef: "fr",
                info: {
                  type: "texte",
                  début: 0,
                  fin: 5,
                  texte: "Météo historique pour la région de Montréal",
                },
              },
              score: 1,
            };

            expect(résultatNom).to.deep.equal(réfRésNom);
            expect(résultatTous).to.deep.equal(réfRésNom);
          });
        });

        describe("Selon variable", function () {
          let idProjet: string;
          let idVariable: string;
          let résultatNom:
            | résultatObjectifRecherche<
                infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;
          let résultatId:
            | résultatObjectifRecherche<
                infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;
          let résultatTous:
            | résultatObjectifRecherche<
                infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idProjet = await client.bds!.créerBd("ODbl-1_0");
            idVariable = await client.variables!.créerVariable("numérique");

            const fRechercheNom = rechercherProjetSelonNomVariable("Précip");
            fsOublier.push(
              await fRechercheNom(client, idProjet, (r) => (résultatNom = r))
            );

            const fRechercheId = rechercherProjetSelonIdVariable(
              idVariable.slice(0, 15)
            );
            fsOublier.push(
              await fRechercheId(client, idProjet, (r) => (résultatId = r))
            );

            const fRechercheTous = rechercherProjetSelonVariable("Précip");
            fsOublier.push(
              await fRechercheTous(client, idProjet, (r) => (résultatTous = r))
            );
          });

          after(() => {
            fsOublier.forEach((f) => f());
          });

          step("Pas de résultat quand la bd n'a pas de variable", async () => {
            expect(résultatId).to.be.undefined;
            expect(résultatNom).to.be.undefined;
            expect(résultatTous).to.be.undefined;
          });

          step("Ajout variable détecté", async () => {
            const idBd = await client.bds!.créerBd("ODbl-1_0");
            await client.projets!.ajouterBdProjet(idProjet, idBd);

            const idTableau = await client.bds!.ajouterTableauBd(idBd);
            await client.tableaux!.ajouterColonneTableau(idTableau, idVariable);

            const réfRésId: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              type: "résultat",
              clef: idVariable,
              de: "variable",
              info: {
                type: "résultat",
                de: "id",
                info: {
                  type: "texte",
                  début: 0,
                  fin: 15,
                  texte: idVariable,
                },
              },
              score: 1,
            };

            expect(résultatId).to.deep.equal(réfRésId);
          });

          step("Ajout nom variable détecté", async () => {
            await client.variables!.ajouterNomsVariable(idVariable, {
              fr: "Précipitation mensuelle",
            });

            const réfRésNom: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              type: "résultat",
              clef: idVariable,
              de: "variable",
              info: {
                type: "résultat",
                de: "nom",
                clef: "fr",
                info: {
                  type: "texte",
                  début: 0,
                  fin: 6,
                  texte: "Précipitation mensuelle",
                },
              },
              score: 1,
            };

            expect(résultatNom).to.deep.equal(réfRésNom);
            expect(résultatTous).to.deep.equal(réfRésNom);
          });
        });

        describe("Selon bd", function () {
          let idProjet: string;
          let idBd: string;
          let résultatId:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;
          let résultatNom:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;
          let résultatDescr:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;
          let résultatVariable:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;
          let résultatMotsClef:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idProjet = await client.projets!.créerProjet();
            idBd = await client.bds!.créerBd("ODbl-1_0");

            const fRechercheNom = rechercherProjetSelonBd("Hydrologie");
            fsOublier.push(
              await fRechercheNom(client, idProjet, (r) => (résultatNom = r))
            );

            const fRechercheId = rechercherProjetSelonIdBd(idBd.slice(0, 15));
            fsOublier.push(
              await fRechercheId(client, idProjet, (r) => (résultatId = r))
            );

            const fRechercheDescr = rechercherProjetSelonBd("Montréal");
            fsOublier.push(
              await fRechercheDescr(
                client,
                idProjet,
                (r) => (résultatDescr = r)
              )
            );

            const fRechercheVariables = rechercherProjetSelonBd("Température");
            fsOublier.push(
              await fRechercheVariables(
                client,
                idProjet,
                (r) => (résultatVariable = r)
              )
            );

            const fRechercheMotsClef = rechercherProjetSelonBd("Météo");
            fsOublier.push(
              await fRechercheMotsClef(
                client,
                idProjet,
                (r) => (résultatMotsClef = r)
              )
            );
          });

          after(() => {
            fsOublier.forEach((f) => f());
          });

          step("Résultat id détecté", async () => {
            await client.projets!.ajouterBdProjet(idProjet, idBd);

            const réfRés: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              type: "résultat",
              de: "bd",
              clef: idBd,
              info: {
                type: "résultat",
                de: "id",
                info: {
                  type: "texte",
                  début: 0,
                  fin: 15,
                  texte: idBd,
                },
              },
              score: 1,
            };

            expect(résultatId).to.be.deep.equal(réfRés);
          });

          step("Résultat nom détecté", async () => {
            await client.bds!.ajouterNomsBd(idBd, { fr: "Hydrologie" });

            const réfRés: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              type: "résultat",
              de: "bd",
              clef: idBd,
              info: {
                type: "résultat",
                clef: "fr",
                de: "nom",
                info: {
                  type: "texte",
                  début: 0,
                  fin: 10,
                  texte: "Hydrologie",
                },
              },
              score: 1,
            };

            expect(résultatNom).to.deep.equal(réfRés);
          });

          step("Résultat descr détecté", async () => {
            await client.bds!.ajouterDescriptionsBd(idBd, {
              fr: "Hydrologie de Montréal",
            });
            const réfRés: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              type: "résultat",
              de: "bd",
              clef: idBd,
              info: {
                type: "résultat",
                clef: "fr",
                de: "descr",
                info: {
                  type: "texte",
                  début: 14,
                  fin: 22,
                  texte: "Hydrologie de Montréal",
                },
              },
              score: 1,
            };
            expect(résultatDescr).to.deep.equal(réfRés);
          });

          step("Résultat variable détecté", async () => {
            const idVariable = await client.variables!.créerVariable(
              "numérique"
            );
            const idTableau = await client.bds!.ajouterTableauBd(idBd);
            await client.tableaux!.ajouterColonneTableau(idTableau, idVariable);
            await client.variables!.ajouterNomsVariable(idVariable, {
              fr: "Température maximale",
            });

            const réfRés: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatRecherche<infoRésultatTexte>>
            > = {
              type: "résultat",
              de: "bd",
              clef: idBd,
              info: {
                type: "résultat",
                clef: idVariable,
                de: "variable",
                info: {
                  type: "résultat",
                  de: "nom",
                  clef: "fr",
                  info: {
                    type: "texte",
                    début: 0,
                    fin: 11,
                    texte: "Température maximale",
                  },
                },
              },
              score: 1,
            };

            expect(résultatVariable).to.deep.equal(réfRés);
          });

          step("Résultat mot-clef détecté", async () => {
            const idMotClef = await client.motsClefs!.créerMotClef();
            await client.bds!.ajouterMotsClefsBd(idBd, idMotClef);
            await client.motsClefs!.ajouterNomsMotClef(idMotClef, {
              fr: "Météorologie",
            });

            const réfRés: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatRecherche<infoRésultatTexte>>
            > = {
              type: "résultat",
              de: "bd",
              clef: idBd,
              info: {
                type: "résultat",
                clef: idMotClef,
                de: "motClef",
                info: {
                  type: "résultat",
                  de: "nom",
                  clef: "fr",
                  info: {
                    type: "texte",
                    début: 0,
                    fin: 5,
                    texte: "Météorologie",
                  },
                },
              },
              score: 1,
            };

            expect(résultatMotsClef).to.deep.equal(réfRés);
          });
        });

        describe.skip("Selon texte", function () {
          let idProjet: string;
          let idBd: string;
          let résultatId:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;
          let résultatNom:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;
          let résultatDescr:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;
          let résultatBd:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;
          let résultatVariable:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;
          let résultatMotsClef:
            | résultatObjectifRecherche<
                | infoRésultatTexte
                | infoRésultatRecherche<
                    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
                  >
              >
            | undefined;

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idProjet = await client.projets!.créerProjet();
            idBd = await client.bds!.créerBd("ODbl-1_0");

            const fRechercheNom = rechercherProjetSelonTexte("Hydrologie");
            fsOublier.push(
              await fRechercheNom(client, idProjet, (r) => (résultatNom = r))
            );

            const fRechercheId = rechercherProjetSelonTexte(
              idProjet.slice(0, 15)
            );
            fsOublier.push(
              await fRechercheId(client, idProjet, (r) => (résultatId = r))
            );

            const fRechercheDescr = rechercherProjetSelonTexte("Montréal");
            fsOublier.push(
              await fRechercheDescr(
                client,
                idProjet,
                (r) => (résultatDescr = r)
              )
            );

            const fRechercheBds = rechercherProjetSelonTexte(idBd);
            fsOublier.push(
              await fRechercheBds(client, idProjet, (r) => (résultatBd = r))
            );

            const fRechercheVariables =
              rechercherProjetSelonTexte("Température");
            fsOublier.push(
              await fRechercheVariables(
                client,
                idProjet,
                (r) => (résultatVariable = r)
              )
            );

            const fRechercheMotsClef = rechercherProjetSelonTexte("Météo");
            fsOublier.push(
              await fRechercheMotsClef(
                client,
                idProjet,
                (r) => (résultatMotsClef = r)
              )
            );
          });

          after(() => {
            fsOublier.forEach((f) => f());
          });

          step("Résultat id détecté", async () => {
            expect(résultatId).to.be.deep.equal({
              type: "résultat",
              de: "id",
              info: {
                type: "texte",
                début: 0,
                fin: 15,
                texte: idProjet,
              },
              score: 1,
            });
          });

          step("Résultat nom détecté", async () => {
            await client.projets!.ajouterNomsProjet(idProjet, {
              fr: "Hydrologie",
            });

            expect(résultatNom).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "nom",
              info: {
                type: "texte",
                début: 0,
                fin: 10,
                texte: "Hydrologie",
              },
              score: 1,
            });
          });

          step("Résultat descr détecté", async () => {
            await client.projets!.ajouterDescriptionsProjet(idProjet, {
              fr: "Hydrologie de Montréal",
            });
            expect(résultatDescr).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "descr",
              info: {
                type: "texte",
                début: 14,
                fin: 22,
                texte: "Hydrologie de Montréal",
              },
              score: 1,
            });
          });

          step("Résultat bd détecté", async () => {
            await client.projets!.ajouterBdProjet(idProjet, idBd);

            expect(résultatBd).to.deep.equal({
              type: "résultat",
              clef: idBd,
              de: "bd",
              info: {
                type: "résultat",
                de: "id",
                info: {
                  type: "texte",
                  début: 0,
                  fin: idBd.length,
                  texte: idBd,
                },
              },
              score: 1,
            });
          });

          step("Résultat variable détecté", async () => {
            const idVariable = await client.variables!.créerVariable(
              "numérique"
            );
            const idTableau = await client.bds!.ajouterTableauBd(idBd);
            await client.tableaux!.ajouterColonneTableau(idTableau, idVariable);
            await client.variables!.ajouterNomsVariable(idVariable, {
              fr: "Température maximale",
            });

            const résRéf: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              type: "résultat",
              clef: idVariable,
              de: "variable",
              info: {
                type: "résultat",
                de: "nom",
                clef: "fr",
                info: {
                  type: "texte",
                  début: 0,
                  fin: 11,
                  texte: "Température maximale",
                },
              },
              score: 1,
            };

            expect(résultatVariable).to.deep.equal(résRéf);
          });

          step("Résultat mot-clef détecté", async () => {
            const idMotClef = await client.motsClefs!.créerMotClef();
            await client.motsClefs!.ajouterNomsMotClef(idMotClef, {
              fr: "Météorologie",
            });
            await client.bds!.ajouterMotsClefsBd(idBd, idMotClef);

            const résRéf: résultatObjectifRecherche<
              infoRésultatRecherche<infoRésultatTexte>
            > = {
              type: "résultat",
              clef: idMotClef,
              de: "motClef",
              info: {
                type: "résultat",
                de: "nom",
                clef: "fr",
                info: {
                  type: "texte",
                  début: 0,
                  fin: 5,
                  texte: "Météorologie",
                },
              },
              score: 1,
            };

            expect(résultatMotsClef).to.deep.equal(résRéf);
          });
        });
      });
    });
  });
});
