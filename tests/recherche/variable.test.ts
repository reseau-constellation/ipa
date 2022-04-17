import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
} from "@/utils";
import {
  rechercherVariableSelonNom,
  rechercherVariableSelonTexte,
} from "@/recherche/variable";

import { testAPIs, config } from "../sfipTest";
import { générerClients, typesClients } from "../utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Rechercher variables", function () {
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
          let idVariable: string;
          let résultat:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idVariable = await client.variables!.créerVariable("numérique");

            const fRecherche = rechercherVariableSelonNom("Radiation solaire");
            fOublier = await fRecherche(
              client,
              idVariable,
              (r) => (résultat = r)
            );
          });

          after(() => {
            if (fOublier) fOublier();
          });

          step("Pas de résultat quand la variable n'a pas de nom", async () => {
            expect(résultat).to.be.undefined;
          });
          it("Pas de résultat si le mot-clef n'a vraiment rien à voir", async () => {
            await client.variables!.ajouterNomsVariable(idVariable, {
              த: "சூரிய கதிர்வீச்சு",
            });
            expect(résultat).to.be.undefined;
          });
          it("Résultat si la variable est presque exacte", async () => {
            await client.variables!.ajouterNomsVariable(idVariable, {
              es: "Radiación solar",
            });

            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "es",
              de: "nom",
              info: {
                type: "texte",
                début: 0,
                fin: 15,
                texte: "Radiación solar",
              },
              score: 0.2,
            });
          });
          it("Résultat si le mot-clef est exacte", async () => {
            await client.variables!.ajouterNomsVariable(idVariable, {
              fr: "Radiation solaire",
            });
            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "nom",
              info: {
                type: "texte",
                début: 0,
                fin: 17,
                texte: "Radiation solaire",
              },
              score: 1,
            });
          });
        });

        describe("Selon descr", function () {
          let idVariable: string;
          let résultat:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idVariable = await client.variables!.créerVariable("numérique");

            const fRecherche = rechercherVariableSelonDescr("Radiation solaire");
            fOublier = await fRecherche(
              client,
              idVariable,
              (r) => (résultat = r)
            );
          });

          after(() => {
            if (fOublier) fOublier();
          });

          step("Pas de résultat quand la variable n'a pas de description", async () => {
            expect(résultat).to.be.undefined;
          });
          it("Pas de résultat si la description n'a vraiment rien à voir", async () => {
            await client.variables!.ajouterDescriptionsVariable(idVariable, {
              த: "சூரிய கதிர்வீச்சு",
            });
            expect(résultat).to.be.undefined;
          });
          it("Résultat si la variable est presque exacte", async () => {
            await client.variables!.ajouterDescriptionsVariable(idVariable, {
              es: "Radiación solar",
            });

            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "es",
              de: "nom",
              info: {
                type: "texte",
                début: 0,
                fin: 15,
                texte: "Radiación solar",
              },
              score: 0.2,
            });
          });
          it("Résultat si la description est exacte", async () => {
            await client.variables!.ajouterDescriptionsVariable(idVariable, {
              fr: "Radiation solaire",
            });
            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "nom",
              info: {
                type: "texte",
                début: 0,
                fin: 17,
                texte: "Radiation solaire",
              },
              score: 1,
            });
          });
        });

        describe("Selon texte", function () {
          let idVariable: string;
          let résultatId:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;
          let résultatNom:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idVariable = await client.variables!.créerVariable("numérique");

            const fRechercheNom = rechercherVariableSelonTexte("précipitation");
            fsOublier.push(
              await fRechercheNom(client, idVariable, (r) => (résultatNom = r))
            );

            const fRechercheId = rechercherVariableSelonTexte(
              idVariable.slice(0, 15)
            );
            fsOublier.push(
              await fRechercheId(client, idVariable, (r) => (résultatId = r))
            );

            await client.variables!.ajouterNomsVariable(idVariable, {
              fr: "précipitation",
            });
          });

          after(() => {
            fsOublier.forEach((f) => f());
          });

          step("Résultat nom détecté", async () => {
            expect(résultatNom).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "nom",
              info: {
                type: "texte",
                début: 0,
                fin: 13,
                texte: "précipitation",
              },
              score: 1,
            });
          });

          it("Résultat id détecté", async () => {
            expect(résultatId).to.be.deep.equal({
              type: "résultat",
              de: "id",
              info: {
                type: "texte",
                début: 0,
                fin: 15,
                texte: idVariable,
              },
              score: 1,
            });
          });
        });
      });
    });
  });
});
