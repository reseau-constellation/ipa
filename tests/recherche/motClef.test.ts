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
  rechercherMotClefSelonNom,
  rechercherMotClefSelonTexte,
} from "@/recherche/motClef";

import { testAPIs, config } from "../sfipTest";
import { générerClients, typesClients } from "../utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Rechercher mots clefs", function () {
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
          let idMotClef: string;
          let résultat:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idMotClef = await client.motsClefs!.créerMotClef();

            const fRecherche = rechercherMotClefSelonNom("hydrologie");
            fOublier = await fRecherche(
              client,
              idMotClef,
              (r) => (résultat = r)
            );
          });

          after(() => {
            if (fOublier) fOublier();
          });

          step("Pas de résultat quand le mot-clef n'a pas de nom", async () => {
            expect(résultat).to.be.undefined;
          });
          it("Pas de résultat si le mot-clef n'a vraiment rien à voir", async () => {
            await client.motsClefs!.ajouterNomsMotClef({id: idMotClef, noms: {
              த: "நீரியல்",
            }});
            expect(résultat).to.be.undefined;
          });
          it("Résultat si le mot-clef est presque exacte", async () => {
            await client.motsClefs!.ajouterNomsMotClef({id: idMotClef, noms: {
              fr: "Sciences hydrologiques",
            }});

            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "nom",
              info: {
                type: "texte",
                début: 9,
                fin: 19,
                texte: "Sciences hydrologiques",
              },
              score: 0.5,
            });
          });
          it("Résultat si le mot-clef est exacte", async () => {
            await client.motsClefs!.ajouterNomsMotClef({id: idMotClef, noms: {
              fr: "hydrologie",
            }});
            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "nom",
              info: {
                type: "texte",
                début: 0,
                fin: 10,
                texte: "hydrologie",
              },
              score: 1,
            });
          });
        });

        describe("Selon texte", function () {
          let idMotClef: string;
          let résultatId:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;
          let résultatNom:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idMotClef = await client.motsClefs!.créerMotClef();

            const fRechercheNom = rechercherMotClefSelonTexte("hydrologie");
            fsOublier.push(
              await fRechercheNom(client, idMotClef, (r) => (résultatNom = r))
            );

            const fRechercheId = rechercherMotClefSelonTexte(
              idMotClef.slice(0, 15)
            );
            fsOublier.push(
              await fRechercheId(client, idMotClef, (r) => (résultatId = r))
            );

            await client.motsClefs!.ajouterNomsMotClef({id: idMotClef, noms: {
              fr: "hydrologie",
            }});
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
                fin: 10,
                texte: "hydrologie",
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
                texte: idMotClef,
              },
              score: 1,
            });
          });
        });
      });
    });
  });
});
