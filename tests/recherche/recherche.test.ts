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

import { testAPIs, config } from "../sfipTest";
import { générerClients, attendreRésultat, typesClients } from "../utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Rechercher avec client", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;
        let client2: ClientConstellation;
        let client3: ClientConstellation;

        before(async () => {
          enregistrerContrôleurs();
          ({ fOublier: fOublierClients, clients } = await générerClients(
            3,
            API,
            type
          ));
          [client, client2, client3] = clients;
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("Membres", async () => {
          let fOublier: schémaFonctionOublier;
          let fChangerN: (n: number) => void;

          const rés: { ultat?: résultatObjectifRecherche<infoRésultatTexte>[] } = {}
          before(async () => {
            ({ fOublier, fChangerN } = await client.recherche!.rechercherProfilSelonNom(
              "Julien",
              membres => rés.ultat = membres,
              2,
            ))
          })

          after(() => {
              if (fOublier) fOublier();
          });

          step("Moins de résultats que demandé s'il n'y a vraiment rien", async () => {
            const réf: résultatObjectifRecherche<infoRésultatTexte>[] = [
              {
                score: 1,
                type: "résultat",
                de: "nom",
                info: {
                  type: "texte",
                  texte: "Julien",
                  début: 0,
                  fin: 6
                }
              }
            ]
            await client2.profil!.sauvegarderNom("fr", "Julien");

            await attendreRésultat(rés, "ultat", x=>x && !!x.length);
            expect(rés.ultat).to.have.deep.members(réf);
          })

          step("On suit les changements", async () => {
            await client3.profil!.sauvegarderNom("fr", "Julien");
            // expect(rés.ultat).to.have.deep.members(réf);
          })


          step("Changer N désiré", async () => {
            fChangerN(1);
            // expect(rés.ultat).to.have.deep.members(réf);
          });

        });
        describe.skip("Variables", async () => {});
        describe.skip("Mots-clefs", async () => {});
        describe.skip("Bds", async () => {});
        describe.skip("Projets", async () => {});
      });
    });
  });
});
