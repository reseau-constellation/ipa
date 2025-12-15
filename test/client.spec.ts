import { attente, dossiers } from "@constl/utils-tests";

import { isElectronMain, isNode } from "wherearewe";

import { expect } from "aegir/chai";

import { générerClientsInternes } from "./ressources/utils.js";
import type { schémaFonctionOublier } from "@/types.js";
import type { Constellation } from "@/client.js";
import { créerConstellation } from "@/index.js";

if (isNode || isElectronMain) {
  describe("Concurrence", function () {
    /*describe.skip("Même dossier - serveur local", async () => {
      let fermerServeur: schémaFonctionOublier;
      let port: number;

      let dossier: string;
      let fEffacer: () => void;

      before(async () => {
        const {lancerServeur} = await import("@constl/serveur");
        ({ dossier, fEffacer } = await dossiers.dossierTempo());
        ({fermerServeur, port} = await lancerServeur({ optsConstellation: { dossier }}));
        
      });

      after(async () => {
        await fermerServeur();
        try {
          fEffacer?.();
        } catch (e) {
          if ((isNode || isElectronMain) && process.platform === "win32") {
            console.log("On ignore ça sur Windows\n", e);
            return;
          } else {
            throw e;
          }
        }
      });

      it("Erreur pour la deuxième instance, avec port disponible", async () => {
        const constl2 = créerConstellation({ dossier });
        await expect(constl2.obtIdCompte()).to.be.rejectedWith(
          `Ce compte est déjà lancé, et le serveur local est disponible sur le port ${port}.`,
        );
       await fermerServeur();
      });
    });*/
  });

  describe("Fonctionalités client", function () {
    let fOublierClients: () => Promise<void>;
    let clients: Constellation[];
    let client: Constellation, client2: Constellation;

    let idCompte2: string;

    before(async () => {
      ({ fOublier: fOublierClients, clients } = await générerClientsInternes({
        n: 2,
      }));
      [client, client2] = clients;

      idCompte2 = await client2.obtIdCompte();
    });

    after(async () => {
      if (fOublierClients) await fOublierClients();
    });

    describe("Suivre protocoles", function () {
      it.skip("Suivre protocoles compte");
    });

    describe("Dispositif", function () {
      it("Détecter type dispositif", async () => {
        const typeDispositif = client.détecterTypeDispositif();
        if (isElectronMain) expect(typeDispositif).to.eq("ordinateur");
        else if (isNode) expect(typeDispositif).to.eq("serveur");
        else expect(typeDispositif).to.eq("navigateur");
      });
    });

    describe("Suivre empreinte têtes", function () {
      let idBd: string;
      let idBdListe: string;
      let idBd2: string;
      let fOublier: schémaFonctionOublier;

      const rés = new attente.AttendreRésultat<string>();

      before(async () => {
        idBd = await client.créerBdIndépendante({ type: "keyvalue" });
        idBdListe = await client.créerBdIndépendante({ type: "set" });
        idBd2 = await client.créerBdIndépendante({ type: "set" });

        fOublier = await client.suivreEmpreinteTêtesBdRécursive({
          idBd,
          f: (empr) => rés.mettreÀJour(empr),
        });
      });

      after(async () => {
        if (fOublier) await fOublier();
        rés.toutAnnuler();
      });

      it("Ajout élément", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const empreinteAvant = await rés.attendreExiste();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.set("clef", idBd2);
        await fOublier();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });

      it("Enlever élément", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const empreinteAvant = await rés.attendreExiste();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.del("clef");
        await fOublier();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });

      it("Ajout récursif", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const { bd, fOublier } = await orbite.ouvrirBdTypée({
          id: idBd,
          type: "keyvalue",
          schéma: schémaKVChaîne,
        });
        await bd.set("clef", idBdListe);
        await fOublier();

        const empreinteDébut = await rés.attendreExiste();

        const { bd: bdListe, fOublier: fOublierBdListe } =
          await orbite.ouvrirBdTypée({
            id: idBdListe,
            type: "set",
            schéma: schémaListeChaîne,
          });
        await bdListe.add(idBd2);
        fOublierBdListe();

        const empreinteAvant = await rés.attendreQue(
          (x) => !!x && x !== empreinteDébut,
        );

        const { bd: bd2, fOublier: fOublierBd2 } = await orbite.ouvrirBdTypée({
          id: idBd2,
          type: "set",
          schéma: schémaListeChaîne,
        });
        await bd2.add("abc");
        fOublierBd2();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });

      it("Enlever récursif", async () => {
        const { orbite } = await client.attendreSfipEtOrbite();

        const empreinteAvant = await rés.attendreExiste();

        const { bd: bdListe, fOublier: fOublierBdListe } =
          await orbite.ouvrirBdTypée({
            id: idBdListe,
            type: "set",
            schéma: schémaListeChaîne,
          });
        await bdListe.del(idBd2);
        fOublierBdListe();

        await rés.attendreQue((x) => !!x && x !== empreinteAvant);
      });
    });
  });
}
