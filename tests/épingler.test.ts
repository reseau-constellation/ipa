import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

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

          step("Pas d'épingles pour commencer", async () => {
            expect(variables).to.be.an.empty("array");
          });
          step("Ajouter une épingle", async () => {
            idVariable = await client.épingles!.épinglerBd("numérique");
            expect(variables)
              .to.be.an("array")
              .with.lengthOf(1)
              .that.contains(idVariable);
          });
          step("Enlever une épingle", async () => {
            await client.variables!.effacerVariable(idVariable);
            expect(variables).to.be.an.empty("array");
          });
        });

        describe("Épingler BDs récursives", function () {

          step("Épingler liste récursive", async () => {
            expect(noms).to.be.empty;
          });

          step("Épingler dic récursif", async () => {
            await client.variables!.sauvegarderNomVariable(
              idVariable,
              "fr",
              "Précipitation"
            );
            expect(noms.fr).to.equal("Précipitation");
          });

          step("Désépingler liste récursive", async () => {
            await client.variables!.ajouterNomsVariable(idVariable, {
              த: "மழை",
              हिं: "बारिश",
            });
            expect(noms).to.deep.equal({
              த: "மழை",
              हिं: "बारिश",
              fr: "Précipitation",
            });
          });

          step("Désépingler dic récursif", async () => {
            await client.variables!.sauvegarderNomVariable(
              idVariable,
              "fr",
              "précipitation"
            );
            expect(noms?.fr).to.equal("précipitation");
          });

          step("BD ajoutée individuellement est toujours là", async () => {
            await client.variables!.effacerNomVariable(idVariable, "fr");
            expect(noms).to.deep.equal({ த: "மழை", हिं: "बारिश" });
          });
        });

        describe("Épingler fichiers", function () {

          step("Fichier non épinglé", async () => {
            expect(descrs).to.be.empty;
          });

          step("Fichier épinglé", async () => {
            await client.variables!.sauvegarderDescrVariable(
              idVariable,
              "fr",
              "la quantité de précipitation quotidienne"
            );
            expect(descrs.fr).to.equal(
              "la quantité de précipitation quotidienne"
            );
          });

          step("Fichier désépinglé", async () => {
            await client.variables!.ajouterDescriptionsVariable(idVariable, {
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            });
            expect(descrs).to.deep.equal({
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
              fr: "la quantité de précipitation quotidienne",
            });
          });

          step("Fichier toujours épinglé si présent dans une autre BD", async () => {
            await client.variables!.sauvegarderDescrVariable(
              idVariable,
              "fr",
              "La quantité de précipitation quotidienne"
            );
            expect(descrs?.fr).to.equal(
              "La quantité de précipitation quotidienne"
            );
          });

          step("Fichier épinglé dans BD récursive", async () => {
            await client.variables!.effacerDescrVariable(idVariable, "fr");
            expect(descrs).to.deep.equal({
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            });
          });

          step("Fichier désépinglé dans BD récursive", async () => {
            await client.variables!.effacerDescrVariable(idVariable, "fr");
            expect(descrs).to.deep.equal({
              த: "தினசரி மழை",
              हिं: "दैनिक बारिश",
            });
          });
        });
      });
    });
  });
});
