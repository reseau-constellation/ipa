import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import { schémaFonctionOublier } from "@/utils";
import { testAPIs, config } from "./sfipTest";
import { attendreRésultat, générerClients, typesClients } from "./utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Mots-clefs", function () {
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

        describe("Création", function () {
          let motsClefs: string[];
          let idMotClef: string;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.motsClefs!.suivreMotsClefs(
              (x) => (motsClefs = x)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });
          step("Pas de mots-clefs pour commencer", async () => {
            expect(motsClefs).to.be.an.empty("array");
          });
          step("Créer des mots-clefs", async () => {
            idMotClef = await client.motsClefs!.créerMotClef();
            expect(motsClefs).to.be.an("array").with.lengthOf(1);
          });
          step("Effacer un mot-clef", async () => {
            await client.motsClefs!.effacerMotClef(idMotClef);
            expect(motsClefs).to.be.an.empty("array");
          });
        });

        describe("Noms", function () {
          const rés: {
            ultat: { [key: string]: string } | undefined;
            ultat2: { [key: string]: string } | undefined;
          } = { ultat: undefined, ultat2: undefined };
          let idMotClef: string;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            idMotClef = await client.motsClefs!.créerMotClef();
            fOublier = await client.motsClefs!.suivreNomsMotClef(
              idMotClef,
              (n) => (rés.ultat = n)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Pas de noms pour commencer", async () => {
            await attendreRésultat(rés, "ultat");
            expect(rés.ultat).to.be.empty;
          });

          step("Ajouter un nom", async () => {
            await client.motsClefs!.sauvegarderNomMotClef(
              idMotClef,
              "fr",
              "Hydrologie"
            );
            expect(rés.ultat?.fr).to.equal("Hydrologie");
          });

          step("Ajouter des noms", async () => {
            await client.motsClefs!.ajouterNomsMotClef(idMotClef, {
              த: "நீரியல்",
              हिं: "जल विज्ञान",
            });
            expect(rés.ultat).to.deep.equal({
              த: "நீரியல்",
              हिं: "जल विज्ञान",
              fr: "Hydrologie",
            });
          });

          step("Changer un nom", async () => {
            await client.motsClefs!.sauvegarderNomMotClef(
              idMotClef,
              "fr",
              "hydrologie"
            );
            expect(rés.ultat?.fr).to.equal("hydrologie");
          });

          step("Effacer un nom", async () => {
            await client.motsClefs!.effacerNomMotClef(idMotClef, "fr");
            expect(rés.ultat).to.deep.equal({
              த: "நீரியல்",
              हिं: "जल विज्ञान",
            });
          });
        });

        describe("Copier mots-clefs", function () {
          let motsClefs: string[];
          let noms: { [key: string]: string };

          let idMotClef2: string;
          let fOublier: schémaFonctionOublier;
          let fOublier2: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.motsClefs!.suivreMotsClefs(
              (x) => (motsClefs = x)
            );

            const idMotClef = await client.motsClefs!.créerMotClef();
            await client.motsClefs!.ajouterNomsMotClef(idMotClef, {
              த: "நீரியல்",
              हिं: "जल विज्ञान",
            });

            idMotClef2 = await client.motsClefs!.copierMotClef(idMotClef);
            fOublier2 = await client.motsClefs!.suivreNomsMotClef(
              idMotClef2,
              (x) => (noms = x)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
            if (fOublier2) fOublier2();
          });

          it("Le mot-clef est copié", async () => {
            expect(motsClefs).to.be.an("array").that.contains(idMotClef2);
          });

          it("Les noms sont copiés", async () => {
            expect(noms).to.deep.equal({ த: "நீரியல்", हिं: "जल विज्ञान" });
          });
        });
      });
    });
  });
});
