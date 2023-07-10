import pkg from "lodash";
const {isSet} = pkg

import type KeyValueStore from "orbit-db-kvstore";
import type FeedStore from "orbit-db-feedstore";

import type { default as ClientConstellation } from "@/client.js";

import { générerClients, typesClients } from "@/utilsTests/client.js";


import {expect} from "aegir/chai";


typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Épingles", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      before(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      });

      after(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Épingler BDs", function () {
        let idBd: string;

        before(async () => {
          idBd = await client!.créerBdIndépendante({ type: "kvstore" });
          await client.épingles!.toutDésépingler();
        });

        it("Pas d'épingles pour commencer", async () => {
          const épingles = await client.épingles!.épingles();
          expect(isSet(épingles)).to.be.true();
          expect(épingles.size).to.equal(0);
        });
        it("Ajouter une épingle", async () => {
          await client.épingles!.épinglerBd({ id: idBd });

          const épingles = await client.épingles!.épingles();
          expect(isSet(épingles)).to.be.true();

          expect(épingles.size).to.equal(1);
          expect(épingles).to.contain(idBd);
        });
        it("Enlever une épingle", async () => {
          await client.épingles!.désépinglerBd({ id: idBd });

          const épingles = await client.épingles!.épingles();
          expect(isSet(épingles)).to.be.true();
          expect(épingles.size).to.equal(0);
        });
      });

      describe("Épingler BDs récursives", function () {
        let idBdListe: string;
        let idBdDic: string;
        let idBdDic2: string;
        let idBdAutre: string;

        before(async () => {
          await client.épingles!.toutDésépingler();

          idBdDic = await client!.créerBdIndépendante({ type: "kvstore" });
          idBdListe = await client!.créerBdIndépendante({ type: "feed" });

          idBdDic2 = await client!.créerBdIndépendante({ type: "kvstore" });
          idBdAutre = await client!.créerBdIndépendante({ type: "kvstore" });
        });

        it("Épingler liste récursive", async () => {
          await client.épingles!.épinglerBd({ id: idBdListe });

          const { bd, fOublier } = await client.ouvrirBd<FeedStore<string>>({
            id: idBdListe,
          });
          await bd.add(idBdAutre);
          await fOublier();

          const épingles = await client.épingles!.épingles();

          expect(épingles.size).to.equal(2);
          expect(épingles).have.members([idBdListe, idBdAutre]);
        });

        it("Désépingler liste récursive", async () => {
          await client.épingles!.désépinglerBd({ id: idBdListe });
          const épingles = await client.épingles!.épingles();
          expect(isSet(épingles)).to.be.true();
          expect(épingles.size).to.equal(0);
        });

        it("Épingler dic récursif", async () => {
          await client.épingles!.épinglerBd({ id: idBdDic });

          const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>(
            { id: idBdDic }
          );
          await bd.set("clef", idBdDic2);
          await fOublier();

          const { bd: bdDic2, fOublier: fOublier2 } = await client.ouvrirBd<
            KeyValueStore<string>
          >({ id: idBdDic2 });
          await bdDic2.set("clef", idBdAutre);
          fOublier2();

          const épingles = await client.épingles!.épingles();

          expect([...épingles]).to.have.members([idBdDic, idBdDic2, idBdAutre]);
        });

        it("Désépingler dic récursif", async () => {
          await client.épingles!.désépinglerBd({ id: idBdDic });
          const épingles = await client.épingles!.épingles();
          expect(épingles.size).to.equal(0);
        });

        it("BD ajoutée individuellement est toujours là", async () => {
          await client.épingles!.épinglerBd({ id: idBdDic });
          await client.épingles!.épinglerBd({ id: idBdAutre });
          await client.épingles!.désépinglerBd({ id: idBdDic });

          const épingles = await client.épingles!.épingles();
          expect(épingles.size).to.equal(1);
          expect(épingles).to.contain(idBdAutre);
        });
      });

      describe("Épingler fichiers", function () {
        let idBd: string;
        let idBd2: string;
        let idBdListe: string;

        const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ";
        const idc2 = "QmRZycUKy3MnRKRxkLu8jTzBEVHZovsYcbhdiwLQ221eBP";

        before(async () => {
          await client.épingles!.toutDésépingler();

          idBd = await client.créerBdIndépendante({ type: "kvstore" });
          idBd2 = await client.créerBdIndépendante({ type: "kvstore" });
          idBdListe = await client.créerBdIndépendante({ type: "feed" });
        });

        it("Fichier non épinglé", async () => {
          expect(await client.épingles!.épinglée({ id: idc })).to.be.false();
        });

        it("Fichier épinglé", async () => {
          const { bd, fOublier } = await client.ouvrirBd<KeyValueStore<string>>(
            { id: idBd }
          );
          await bd.set("clef", idc);
          await bd.set("clef2", idc2);
          await fOublier();

          const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<
            KeyValueStore<string>
          >({ id: idBd2 });
          await bd2.set("clef2", idc2);
          fOublier2();

          await client.épingles!.épinglerBd({ id: idBd });
          await client.épingles!.épinglerBd({ id: idBd2 });

          expect(await client.épingles!.épinglée({ id: idc }));
          expect(await client.épingles!.épinglée({ id: idc2 }));
        });

        it("Fichier désépinglé", async () => {
          await client.épingles!.désépinglerBd({ id: idBd });

          expect(await client.épingles!.épinglée({ id: idc })).to.be.false();
        });

        it("Fichier toujours épinglé si présent dans une autre BD", async () => {
          expect(await client.épingles!.épinglée({ id: idc2 }));

          await client.épingles!.désépinglerBd({ id: idBd2 });

          expect(await client.épingles!.épinglée({ id: idc2 })).to.be.false();
        });

        it("Fichier épinglé dans BD récursive", async () => {
          await client.épingles!.épinglerBd({ id: idBdListe });

          const { bd, fOublier } = await client.ouvrirBd<FeedStore<string>>({
            id: idBdListe,
          });
          await bd.add(idBd);
          await fOublier();

          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(await client.épingles!.épinglée({ id: idc }));
        });

        it("Fichier désépinglé dans BD récursive", async () => {
          await client.épingles!.désépinglerBd({ id: idBdListe });

          expect(await client.épingles!.épinglée({ id: idc })).to.be.false();
        });
      });
    });
  });
});
