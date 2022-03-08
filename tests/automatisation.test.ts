import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";
import KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";

import { testAPIs, config } from "./sfipTest";
import { générerClients, typesClients } from "./utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Épingles", function () {
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

        describe("Importation", function () {

          before(async () => {

          })

          step("Aucune automatisation pour commencer");
          step("Ajout automatisation détecté");
          step("Importation selon fréquence");
          step("Importation selon changements");
          step("Effacer automatisation");
        });

        describe("Exportation", function () {
          step("Exportation selon fréquence");
          step("Exportation selon changements");
          step("Exportation tableau");
          step("Exportation BD");
          step("Exportation projet");

        });

        describe("Exportation nuée bds", function () {
          step("Exportation selon fréquence");
          step("Exportation selon changements");

        });

        describe("Suivre état automatisations", function () {
          it("erreur");
          it("écoute");
          it("sync");
          it("programmée");
        });

      });
    });
  });
});
