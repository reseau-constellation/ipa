import isArray from "lodash/isArray";

import { isElectronMain, isNode } from "wherearewe";

import { enregistrerContrôleurs } from "@/accès/index.js";
import ClientConstellation from "@/client.js";
import { ÉlémentFavorisAvecObjet, épingleDispositif } from "@/favoris.js";
import { schémaFonctionOublier } from "@/utils/index.js";

import { générerClients, typesClients } from "@/utilsTests/index.js";
import { config } from "@/utilsTests/sfipTest.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Favoris", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      beforeAll(async () => {
        enregistrerContrôleurs();
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      }, config.patienceInit);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("estÉpingléSurDispositif", function () {
        test("undefined", async () => {
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: undefined,
          });
          expect(épinglé).toBe(false);
        });
        test("tous", async () => {
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: "TOUS",
          });
          expect(épinglé).toBe(true);
        });
        test("installé", async () => {
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: "INSTALLÉ",
          });
          if (isNode || isElectronMain) {
            expect(épinglé).toBe(true);
          } else {
            expect(épinglé).toBe(false);
          }
        });
        test("installé, pour un autre dispositif", async () => {
          const idOrbiteAutre = "abc";
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: "INSTALLÉ",
            idOrbite: idOrbiteAutre,
          });
          expect(épinglé).toBe(false);
        });
        test("idOrbite", async () => {
          const idOrbite = await client.obtIdOrbite();
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: idOrbite,
          });
          expect(épinglé).toBe(true);
        });
        test("listeIdOrbite", async () => {
          const idOrbite = await client.obtIdOrbite();
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: [idOrbite],
          });
          expect(épinglé).toBe(true);
        });
      });

      describe("Épingler BDs", function () {
        let idBd: string;

        const favo: { ris?: ÉlémentFavorisAvecObjet[] } = {};
        let épingleBd: épingleDispositif;

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

          fsOublier.push(
            await client.favoris!.suivreFavoris({
              f: (favs) => (favo.ris = favs),
            })
          );
          fsOublier.push(
            await client.favoris!.suivreEstÉpingléSurDispositif({
              idObjet: idBd,
              f: (épingle) => (épingleBd = épingle),
            })
          );
        }, config.patience);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("Pas de favori pour commencer", async () => {
          expect(isArray(favo.ris)).toBe(true);
          expect(favo.ris).toHaveLength(0);
        });

        test("Ajouter un favori", async () => {
          await client.favoris!.épinglerFavori({
            id: idBd,
            dispositifs: "TOUS",
          });
          expect(isArray(favo.ris)).toBe(true);

          expect(favo.ris).toHaveLength(1);
          expect(favo.ris).toEqual([
            {
              récursif: true,
              dispositifs: "TOUS",
              dispositifsFichiers: "INSTALLÉ",
              idObjet: idBd,
            },
          ]);
          expect(épingleBd).toEqual({
            idObjet: idBd,
            bd: true,
            fichiers: true,
            récursif: true,
          });
        });

        test("Enlever un favori", async () => {
          await client.favoris!.désépinglerFavori({ id: idBd });
          // await attendreRésultat(favo, "ris", x=>x.length===0);

          expect(favo.ris).toHaveLength(0);
          expect(épingleBd).toEqual({
            idObjet: idBd,
            bd: false,
            fichiers: false,
            récursif: false,
          });
        });

        test(
          "Ajouter un favori avec fichiers",
          async () => {
            const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ";

            const idTableau = await client.bds!.ajouterTableauBd({ idBd });
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
          },
          config.patience
        );
      });
    });
  });
});
