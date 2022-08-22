import { step } from "mocha-steps";
import { jest } from "@jest/globals";

import isSet from "lodash/isSet";

import KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";

import { générerClients, typesClients } from "@/utilsTests";
import { config } from "@/utilsTests/sfipTest";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Épingles", function () {
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

      describe("Épingler BDs", function () {
        let idBd: string;

        beforeAll(async () => {
          idBd = await client!.créerBdIndépendante({ type: "kvstore" });
          await client.épingles!.toutDésépingler();
        });

        step("Pas d'épingles pour commencer", async () => {
          const épingles = client.épingles!.épingles();
          expect(isSet(épingles)).toBe(true);
          expect(épingles).toHaveLength(0);
        });
        step("Ajouter une épingle", async () => {
          await client.épingles!.épinglerBd({ id: idBd });

          const épingles = client.épingles!.épingles();
          expect(isSet(épingles)).toBe(true);

          expect(épingles).toHaveLength(1).that.contains(idBd);
        });
        step("Enlever une épingle", async () => {
          await client.épingles!.désépinglerBd({ id: idBd });

          const épingles = client.épingles!.épingles();
          expect(isSet(épingles)).toBe(true);
          expect(épingles).toHaveLength(0);
        });
      });

      describe("Épingler BDs récursives", function () {
        let idBdListe: string;
        let idBdDic: string;
        let idBdDic2: string;
        let idBdAutre: string;

        beforeAll(async () => {
          await client.épingles!.toutDésépingler();

          idBdDic = await client!.créerBdIndépendante({ type: "kvstore" });
          idBdListe = await client!.créerBdIndépendante({ type: "feed" });

          idBdDic2 = await client!.créerBdIndépendante({ type: "kvstore" });
          idBdAutre = await client!.créerBdIndépendante({ type: "kvstore" });
        });

        step("Épingler liste récursive", async () => {
          await client.épingles!.épinglerBd({ id: idBdListe });

          const { bd, fOublier } = await client.ouvrirBd<FeedStore<string>>({
            id: idBdListe,
          });
          await bd.add(idBdAutre);
          fOublier();

          const épingles = client.épingles!.épingles();

          expect([...épingles])
            .toHaveLength(2)
            .with.members([idBdListe, idBdAutre]);
        });

        step("Désépingler liste récursive", async () => {
          await client.épingles!.désépinglerBd({ id: idBdListe });
          const épingles = client.épingles!.épingles();
          expect(isSet(épingles)).toBe(true);
          expect(épingles).toHaveLength(0);
        });

        step("Épingler dic récursif", async () => {
          await client.épingles!.épinglerBd({ id: idBdDic });

          const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>(
            { id: idBdDic }
          );
          await bd.set("clef", idBdDic2);
          fOublier();

          const { bd: bdDic2, fOublier: fOublier2 } = await client.ouvrirBd<
            KeyValueStore<string>
          >({ id: idBdDic2 });
          await bdDic2.set("clef", idBdAutre);
          fOublier2();

          const épingles = client.épingles!.épingles();

          expect([...épingles]).to.include.members([idBdDic2, idBdAutre]);
        });

        step("Désépingler dic récursif", async () => {
          await client.épingles!.désépinglerBd({ id: idBdDic });
          const épingles = client.épingles!.épingles();
          expect(épingles).toHaveLength(0);
        });

        step("BD ajoutée individuellement est toujours là", async () => {
          await client.épingles!.épinglerBd({ id: idBdDic });
          await client.épingles!.épinglerBd({ id: idBdAutre });
          await client.épingles!.désépinglerBd({ id: idBdDic });

          const épingles = client.épingles!.épingles();
          expect(épingles).toHaveLength(1).and.to.include(idBdAutre);
        });
      });

      describe("Épingler fichiers", function () {
        let idBd: string;
        let idBd2: string;
        let idBdListe: string;

        const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ";
        const idc2 = "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP";

        beforeAll(async () => {
          await client.épingles!.toutDésépingler();

          idBd = await client.créerBdIndépendante({ type: "kvstore" });
          idBd2 = await client.créerBdIndépendante({ type: "kvstore" });
          idBdListe = await client.créerBdIndépendante({ type: "feed" });
        });

        step("Fichier non épinglé", async () => {
          expect(client.épingles!.épinglée({ id: idc })).toBe(false);
        });

        step("Fichier épinglé", async () => {
          const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>(
            { id: idBd }
          );
          await bd.set("clef", idc);
          await bd.set("clef2", idc2);
          fOublier();

          const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<
            KeyValueStore<string>
          >({ id: idBd2 });
          await bd2.set("clef2", idc2);
          fOublier2();

          await client.épingles!.épinglerBd({ id: idBd });
          await client.épingles!.épinglerBd({ id: idBd2 });

          expect(client.épingles!.épinglée({ id: idc }));
          expect(client.épingles!.épinglée({ id: idc2 }));
        });

        step("Fichier désépinglé", async () => {
          await client.épingles!.désépinglerBd({ id: idBd });

          expect(client.épingles!.épinglée({ id: idc })).toBe(false);
        });

        step(
          "Fichier toujours épinglé si présent dans une autre BD",
          async () => {
            expect(client.épingles!.épinglée({ id: idc2 }));

            await client.épingles!.désépinglerBd({ id: idBd2 });

            expect(client.épingles!.épinglée({ id: idc2 })).toBe(false);
          }
        );

        step("Fichier épinglé dans BD récursive", async () => {
          await client.épingles!.épinglerBd({ id: idBdListe });

          const { bd, fOublier } = await client.ouvrirBd<FeedStore<string>>({
            id: idBdListe,
          });
          await bd.add(idBd);
          fOublier();

          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(client.épingles!.épinglée({ id: idc }));
        });

        step("Fichier désépinglé dans BD récursive", async () => {
          await client.épingles!.désépinglerBd({ id: idBdListe });

          expect(client.épingles!.épinglée({ id: idc })).toBe(false);
        });
      });
    });
  });
});
