import pkg from "lodash";
const { isSet } = pkg;

import { générerClient, type ClientConstellation } from "@/index.js";

import {
  client as utilsClientTest,
  attente as utilsTestAttente,
} from "@constl/utils-tests";
const { générerClients } = utilsClientTest;
import { typesClients } from "./ressources/utils.js";


import { expect } from "aegir/chai";
import { schémaFonctionOublier } from "@/types.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Épingles", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      before(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients({
          n: 1,
          type,
          générerClient
        }));
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
          expect([...épingles]).to.not.contain(idBd);
        });
      });

      describe("Épingler BDs récursives", function () {
        let idBdListe: string;
        let idBdDic: string;
        let idBdDic2: string;
        let idBdAutre: string;

        let fOublierÉpingles: schémaFonctionOublier;

        const épingles = new utilsTestAttente.AttendreRésultat<Set<string>>();

        before(async () => {
          await client.épingles!.toutDésépingler();

          idBdDic = await client!.créerBdIndépendante({ type: "kvstore" });
          idBdListe = await client!.créerBdIndépendante({ type: "feed" });

          idBdDic2 = await client!.créerBdIndépendante({ type: "kvstore" });
          idBdAutre = await client!.créerBdIndépendante({ type: "kvstore" });
          fOublierÉpingles = await client.épingles!.suivreÉpingles({
            f: (x) => épingles.mettreÀJour(x),
          });
        });

        after(async () => {
          if (fOublierÉpingles) await fOublierÉpingles();
          épingles.toutAnnuler();
        });

        it("Épingler liste récursive", async () => {
          await client.épingles!.épinglerBd({ id: idBdListe, récursif: true });

          const { bd, fOublier } = await client.ouvrirBd<string>({
            id: idBdListe,
            type: "feed",
          });
          await bd.add(idBdAutre);
          await fOublier();

          const val = await épingles.attendreQue((x) => x.size > 1);

          expect([...val]).to.contain(idBdListe);
          expect([...val]).to.contain(idBdAutre);
        });

        it("Désépingler liste récursive", async () => {
          await client.épingles!.désépinglerBd({ id: idBdListe });
          const épingles = await client.épingles!.épingles();
          expect([...épingles]).to.not.have.members([idBdListe, idBdAutre]);
        });

        it("Épingler dic récursif", async () => {
          await client.épingles!.épinglerBd({ id: idBdDic, récursif: true });

          const { bd, fOublier } = await client.ouvrirBd<{
            [clef: string]: string;
          }>({
            id: idBdDic,
            type: "keyvalue",
          });
          await bd.set("clef", idBdDic2);
          await fOublier();

          const { bd: bdDic2, fOublier: fOublier2 } = await client.ouvrirBd<{
            [clef: string]: string;
          }>({
            id: idBdDic2,
            type: "keyvalue",
          });
          await bdDic2.set("clef", idBdAutre);
          fOublier2();

          const épingles = await client.épingles!.épingles();

          expect([...épingles]).to.have.members([idBdDic, idBdDic2, idBdAutre]);
        });

        it("Désépingler dic récursif", async () => {
          await client.épingles!.désépinglerBd({ id: idBdDic });
          const épingles = await client.épingles!.épingles();
          expect([...épingles]).to.not.have.members([idBdDic, idBdAutre]);
        });

        it("BD ajoutée individuellement est toujours là", async () => {
          await client.épingles!.épinglerBd({ id: idBdDic, récursif: true });
          await client.épingles!.épinglerBd({ id: idBdAutre, récursif: true });
          await client.épingles!.désépinglerBd({ id: idBdDic });

          const épingles = await client.épingles!.épingles();
          expect([...épingles]).to.not.contain(idBdDic);
          expect([...épingles]).to.contain(idBdAutre);
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
          const { bd, fOublier } = await client.ouvrirBd<{
            [clef: string]: string;
          }>({ id: idBd, type: "keyvalue" });
          await bd.set("clef", idc);
          await bd.set("clef2", idc2);
          await fOublier();

          const { bd: bd2, fOublier: fOublier2 } = await client.ouvrirBd<{
            [clef: string]: string;
          }>({
            id: idBd2,
            type: "keyvalue",
          });
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

          const { bd, fOublier } = await client.ouvrirBd<string>({
            id: idBdListe,
            type: "feed",
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
