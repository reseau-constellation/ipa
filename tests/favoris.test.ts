import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import { schémaFonctionOublier } from "@/utils";

import { testAPIs, config } from "./sfipTest";
import { générerClients, typesClients } from "./utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Favoris", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

        let idVariable: string;

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

        describe("Épingler BDs", function () {

          step("Pas de favori pour commencer", async () => {
            expect(variables).to.be.an.empty("array");
          });
          step("Ajouter un favori", async () => {
            idVariable = await client.épingles!.épinglerBd("numérique");
            expect(variables)
              .to.be.an("array")
              .with.lengthOf(1)
              .that.contains(idVariable);
          });
          step("Enlever un favori", async () => {
            await client.variables!.effacerVariable(idVariable);
            expect(variables).to.be.an.empty("array");
          });
          step("Ajouter un favori avec fichiers", async () => {
            await client.variables!.effacerVariable(idVariable);
            expect(variables).to.be.an.empty("array");
          });
        });
      });
    });
  });
});
