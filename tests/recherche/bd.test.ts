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
  rechercherBdSelonNom,
  rechercherBdSelonDescr,
  rechercherBdSelonTexte,
  rechercherBdSelonMotClef,
  rechercherBdSelonVariable,
  rechercherBdSelonIdMotClef,
  rechercherBdSelonIdVariable,
  rechercherBdSelonNomMotClef,
  rechercherBdSelonNomVariable,
} from "@/recherche/bd";

import { testAPIs, config } from "../sfipTest";
import { générerClients, typesClients } from "../utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Rechercher bds", function () {
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
          let idBd: string;
          let résultat:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idBd = await client.bds!.créerBd("ODbl-1_0");

            const fRecherche = rechercherBdSelonNom("Météo");
            fOublier = await fRecherche(client, idBd, (r) => (résultat = r));
          });

          after(() => {
            if (fOublier) fOublier();
          });

          step("Pas de résultat quand la bd n'a pas de nom", async () => {
            expect(résultat).to.be.undefined;
          });

          step("Ajout nom détecté", async () => {
            await client.bds!.ajouterNomsBd(idBd, {
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
          let idBd: string;
          let résultat:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idBd = await client.bds!.créerBd("ODbl-1_0");

            const fRecherche = rechercherBdSelonDescr("Météo");
            fOublier = await fRecherche(client, idBd, (r) => (résultat = r));
          });

          after(() => {
            if (fOublier) fOublier();
          });

          step(
            "Pas de résultat quand la bd n'a pas de description",
            async () => {
              expect(résultat).to.be.undefined;
            }
          );

          step("Ajout description détecté", async () => {
            await client.bds!.ajouterDescriptionsBd(idBd, {
              fr: "Météo historique pour la région de Montréal",
            });

            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "descr",
              info: {
                type: "texte",
                début: 0,
                fin: 5,
                texte: "Météo historique pour la région de Montréal",
              },
              score: 1,
            });
          });
        });

        describe("Selon mot-clef", function () {
          let idBd: string;
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
            idBd = await client.bds!.créerBd("ODbl-1_0");
            idMotClef = await client.motsClefs!.créerMotClef();

            const fRechercheNom = rechercherBdSelonNomMotClef("Météo");
            fsOublier.push(
              await fRechercheNom(client, idBd, (r) => (résultatNom = r))
            );

            const fRechercheId = rechercherBdSelonIdMotClef(
              idMotClef.slice(0, 15)
            );
            fsOublier.push(
              await fRechercheId(client, idBd, (r) => (résultatId = r))
            );

            const fRechercheTous = rechercherBdSelonMotClef("Météo");
            fsOublier.push(
              await fRechercheTous(client, idBd, (r) => (résultatTous = r))
            );
          });

          after(() => {
            fsOublier.forEach((f) => f());
          });

          step("Pas de résultat quand la bd n'a pas de mot-clef", async () => {
            expect(résultatId).to.be.undefined;
            expect(résultatNom).to.be.undefined;
            expect(résultatTous).to.be.undefined;
          });

          step("Ajout mot-clef détecté", async () => {
            await client.bds!.ajouterMotsClefsBd(idBd, idMotClef);

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
          let idBd: string;
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
            idBd = await client.bds!.créerBd("ODbl-1_0");
            idVariable = await client.variables!.créerVariable("numérique");

            const fRechercheNom = rechercherBdSelonNomVariable("Précip");
            fsOublier.push(
              await fRechercheNom(client, idBd, (r) => (résultatNom = r))
            );

            const fRechercheId = rechercherBdSelonIdVariable(
              idVariable.slice(0, 15)
            );
            fsOublier.push(
              await fRechercheId(client, idBd, (r) => (résultatId = r))
            );

            const fRechercheTous = rechercherBdSelonVariable("Précip");
            fsOublier.push(
              await fRechercheTous(client, idBd, (r) => (résultatTous = r))
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

        describe.skip("Selon texte", function () {
          let idBd: string;
          let résultatId:
            | résultatObjectifRecherche<
                infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;
          let résultatNom:
            | résultatObjectifRecherche<
                infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;
          let résultatDescr:
            | résultatObjectifRecherche<
                infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;
          let résultatVariable:
            | résultatObjectifRecherche<
                infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;
          let résultatMotsClef:
            | résultatObjectifRecherche<
                infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
              >
            | undefined;

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idBd = await client.bds!.créerBd("ODbl-1_0");

            const fRechercheNom = rechercherBdSelonTexte("Hydrologie");
            fsOublier.push(
              await fRechercheNom(client, idBd, (r) => (résultatNom = r))
            );

            const fRechercheId = rechercherBdSelonTexte(idBd.slice(0, 15));
            fsOublier.push(
              await fRechercheId(client, idBd, (r) => (résultatId = r))
            );

            const fRechercheDescr = rechercherBdSelonTexte("Montréal");
            fsOublier.push(
              await fRechercheDescr(client, idBd, (r) => (résultatDescr = r))
            );

            const fRechercheVariables = rechercherBdSelonTexte("Température");
            fsOublier.push(
              await fRechercheVariables(
                client,
                idBd,
                (r) => (résultatVariable = r)
              )
            );

            const fRechercheMotsClef = rechercherBdSelonTexte("Météo");
            fsOublier.push(
              await fRechercheMotsClef(
                client,
                idBd,
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
                texte: idBd,
              },
              score: 1,
            });
          });

          step("Résultat nom détecté", async () => {
            await client.bds!.ajouterNomsBd(idBd, { fr: "Hydrologie" });

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
            await client.bds!.ajouterDescriptionsBd(idBd, {
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

          step("Résultat variable détecté", async () => {
            const idVariable = await client.variables!.créerVariable(
              "numérique"
            );
            const idTableau = await client.bds!.ajouterTableauBd(idBd);
            await client.tableaux!.ajouterColonneTableau(idTableau, idVariable);
            await client.variables!.ajouterNomsVariable(idVariable, {
              fr: "Température maximale",
            });

            expect(résultatVariable).to.deep.equal({
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
            });
          });

          step("Résultat mot-clef détecté", async () => {
            const idMotClef = await client.motsClefs!.créerMotClef();
            await client.bds!.ajouterMotsClefsBd(idBd, idMotClef);
            await client.motsClefs!.ajouterNomsMotClef(idMotClef, {
              fr: "Météorologie",
            });

            expect(résultatMotsClef).to.deep.equal({
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
            });
          });
        });
      });
    });
  });
});
