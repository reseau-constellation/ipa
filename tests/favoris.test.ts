import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";
import oùSommesNous from "wherearewe";
import estNode from "is-node";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import { ÉlémentFavorisAvecObjet, épingleDispositif } from "@/favoris";
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

        describe("estÉpingléSurDispositif", function () {
          it("undefined", async () => {
            const épinglé = await client.favoris!.estÉpingléSurDispositif({
              dispositifs: undefined,
            });
            expect(épinglé).to.be.false;
          });
          it("tous", async () => {
            const épinglé = await client.favoris!.estÉpingléSurDispositif({
              dispositifs: "TOUS",
            });
            expect(épinglé).to.be.true;
          });
          it("installé", async () => {
            const épinglé = await client.favoris!.estÉpingléSurDispositif({
              dispositifs: "INSTALLÉ",
            });
            if (estNode || oùSommesNous.isElectronMain) {
              expect(épinglé).to.be.true;
            } else {
              expect(épinglé).to.be.false;
            }
          });
          it("installé, pour un autre dispositif", async () => {
            const idOrbiteAutre = "abc";
            const épinglé = await client.favoris!.estÉpingléSurDispositif({
              dispositifs: "INSTALLÉ",
              idOrbite: idOrbiteAutre,
            });
            expect(épinglé).to.be.false;
          });
          it("idOrbite", async () => {
            const idOrbite = await client.obtIdOrbite();
            const épinglé = await client.favoris!.estÉpingléSurDispositif({
              dispositifs: idOrbite,
            });
            expect(épinglé).to.be.true;
          });
          it("listeIdOrbite", async () => {
            const idOrbite = await client.obtIdOrbite();
            const épinglé = await client.favoris!.estÉpingléSurDispositif({
              dispositifs: [idOrbite],
            });
            expect(épinglé).to.be.true;
          });
        });

        describe("Épingler BDs", function () {
          let idBd: string;

          let favoris: ÉlémentFavorisAvecObjet[];
          let épingleBd: épingleDispositif;

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

            fsOublier.push(
              await client.favoris!.suivreFavoris({
                f: (favs) => (favoris = favs),
              })
            );
            fsOublier.push(
              await client.favoris!.suivreEstÉpingléSurDispositif({
                idObjet: idBd,
                f: (épingle) => (épingleBd = épingle),
              })
            );
          });

          after(() => {
            fsOublier.forEach((f) => f());
          });

          step("Pas de favori pour commencer", async () => {
            expect(favoris).to.be.an.empty("array");
          });

          step("Ajouter un favori", async () => {
            await client.favoris!.épinglerFavori({
              id: idBd,
              dispositifs: "TOUS",
            });
            expect(favoris)
              .to.be.an("array")
              .with.lengthOf(1)
              .with.deep.members([
                {
                  récursif: true,
                  dispositifs: "TOUS",
                  dispositifsFichiers: "INSTALLÉ",
                  idObjet: idBd,
                },
              ]);
            expect(épingleBd).to.deep.equal({
              idObjet: idBd,
              bd: true,
              fichiers: true,
              récursif: true,
            });
          });

          step("Enlever un favori", async () => {
            await client.favoris!.désépinglerFavori({ id: idBd });
            expect(favoris).to.be.empty;
            expect(épingleBd).to.deep.equal({
              idObjet: idBd,
              bd: false,
              fichiers: false,
              récursif: false,
            });
          });

          step("Ajouter un favori avec fichiers", async () => {
            const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ";

            const idTableau = await client.bds!.ajouterTableauBd({ id: idBd });
            const idVarPhoto = await client.variables!.créerVariable({
              catégorie: "photo",
            });
            const idColPhoto = await client.tableaux!.ajouterColonneTableau({
              idTableau,
              idVariable: idVarPhoto,
            });
            await client.tableaux!.ajouterÉlément({
              idTableau,
              vals: {
                [idColPhoto]: idc,
              },
            });

            expect(client.épingles!.épinglée({ id: idc }));
          });
        });
      });
    });
  });
});
