import { jest } from "@jest/globals";
import isArray from "lodash/isArray";

import oùSommesNous from "wherearewe";
import estNode from "is-node";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import { ÉlémentFavorisAvecObjet, épingleDispositif } from "@/favoris";
import { schémaFonctionOublier } from "@/utils";

import { générerClients, typesClients } from "@/utilsTests";
import { config } from "@/utilsTests/sfipTest";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Favoris", function () {
      jest.setTimeout(config.timeout);

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
      });

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("estÉpingléSurDispositif", function () {
        it("undefined", async () => {
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: undefined,
          });
          expect(épinglé).toBe(false);
        });
        it("tous", async () => {
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: "TOUS",
          });
          expect(épinglé).toBe(true);
        });
        it("installé", async () => {
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: "INSTALLÉ",
          });
          if (estNode || oùSommesNous.isElectronMain) {
            expect(épinglé).toBe(true);
          } else {
            expect(épinglé).toBe(false);
          }
        });
        it("installé, pour un autre dispositif", async () => {
          const idOrbiteAutre = "abc";
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: "INSTALLÉ",
            idOrbite: idOrbiteAutre,
          });
          expect(épinglé).toBe(false);
        });
        it("idOrbite", async () => {
          const idOrbite = await client.obtIdOrbite();
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: idOrbite,
          });
          expect(épinglé).toBe(true);
        });
        it("listeIdOrbite", async () => {
          const idOrbite = await client.obtIdOrbite();
          const épinglé = await client.favoris!.estÉpingléSurDispositif({
            dispositifs: [idOrbite],
          });
          expect(épinglé).toBe(true);
        });
      });

      describe("Épingler BDs", function () {
        let idBd: string;

        let favoris: ÉlémentFavorisAvecObjet[];
        let épingleBd: épingleDispositif;

        const fsOublier: schémaFonctionOublier[] = [];

        beforeEach(async () => {
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

        afterEach(() => {
          fsOublier.forEach((f) => f());
        });

        test("Pas de favori pour commencer", async () => {
          expect(isArray(favoris)).toBe(true);
          expect(favoris).toHaveLength(0);
        });

        test("Ajouter un favori", async () => {
          await client.favoris!.épinglerFavori({
            id: idBd,
            dispositifs: "TOUS",
          });
          expect(isArray(favoris)).toBe(true);

          expect(favoris)
            .toHaveLength(1)
          expect(favoris).toEqual([
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
          expect(favoris).toHaveLength(0);
          expect(épingleBd).toEqual({
            idObjet: idBd,
            bd: false,
            fichiers: false,
            récursif: false,
          });
        });

        test("Ajouter un favori avec fichiers", async () => {
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
