import { isElectronMain, isNode } from "wherearewe";

import type { ÉlémentFavorisAvecObjet, épingleDispositif } from "@/favoris.js";
import type { schémaFonctionOublier } from "@/types.js";
import { créerConstellation, type ClientConstellation } from "@/index.js";

import {
  attente,
  constellation as utilsTestConstellation,
  attente as utilsTestAttente,
} from "@constl/utils-tests";
const { créerConstellationsTest } = utilsTestConstellation;

import { expect } from "aegir/chai";

describe("Favoris", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
      n: 1,

      créerConstellation,
    }));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("estÉpingléSurDispositif", function () {
    it("undefined", async () => {
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: undefined,
      });
      expect(épinglé).to.be.false();
    });
    it("tous", async () => {
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: "TOUS",
      });
      expect(épinglé).to.be.true();
    });
    it("installé", async () => {
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: "INSTALLÉ",
      });
      if (isNode || isElectronMain) {
        expect(épinglé).to.be.true();
      } else {
        expect(épinglé).to.be.false();
      }
    });
    it("installé, pour un autre dispositif", async () => {
      const idDispositifAutre = "abc";
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: "INSTALLÉ",
        idDispositif: idDispositifAutre,
      });
      expect(épinglé).to.be.false();
    });
    it("idDispositif", async () => {
      const idDispositif = await client.obtIdDispositif();
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: idDispositif,
      });
      expect(épinglé).to.be.true();
    });
    it("listeIdDispositif", async () => {
      const idDispositif = await client.obtIdDispositif();
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: [idDispositif],
      });
      expect(épinglé).to.be.true();
    });
  });

  describe("Épingler BDs", function () {
    let idBd: string;

    const favoris = new utilsTestAttente.AttendreRésultat<
      ÉlémentFavorisAvecObjet[]
    >();
    const épingleBd = new attente.AttendreRésultat<épingleDispositif>();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });

      fsOublier.push(
        await client.favoris.suivreFavoris({
          f: (favs) => favoris.mettreÀJour(favs),
        }),
      );
      fsOublier.push(
        await client.favoris.suivreEstÉpingléSurDispositif({
          idObjet: idBd,
          f: (épingle) => épingleBd.mettreÀJour(épingle),
        }),
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Pas de favori pour commencer", async () => {
      const val = await favoris.attendreExiste();
      expect(Array.isArray(val)).to.be.true();
      expect(val.length).to.equal(0);
    });

    it("Ajouter un favori", async () => {
      await client.favoris.épinglerFavori({
        idObjet: idBd,
        dispositifs: "TOUS",
      });
      const val = await favoris.attendreQue((x) => !!x.length);
      expect(val).to.be.an("array");

      expect(val.length).to.equal(1);
      expect(val).to.have.deep.members([
        {
          récursif: true,
          dispositifs: "TOUS",
          dispositifsFichiers: "INSTALLÉ",
          idObjet: idBd,
        },
      ]);

      const valÉpingleBd = await épingleBd.attendreQue((x) => x.bd);
      expect(valÉpingleBd).to.deep.equal({
        idObjet: idBd,
        bd: true,
        fichiers: isElectronMain || isNode,
        récursif: true,
      });
    });

    it("Enlever un favori", async () => {
      await client.favoris.désépinglerFavori({ idObjet: idBd });

      const val = await favoris.attendreQue((x) => x.length === 0);
      expect(val.length).to.equal(0);

      const valÉpingleBd = await épingleBd.attendreQue((x) => !x.bd);
      expect(valÉpingleBd).to.deep.equal({
        idObjet: idBd,
        bd: false,
        fichiers: false,
        récursif: false,
      });
    });

    it("Ajouter un favori avec fichiers", async () => {
      const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ";

      const idTableau = await client.bds.ajouterTableauBd({ idBd });
      const idVarPhoto = await client.variables.créerVariable({
        catégorie: "image",
      });
      const idColPhoto = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVarPhoto,
      });
      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: {
          [idColPhoto]: idc,
        },
      });

      expect(await client.épingles.épinglée({ id: idc }));
    });
  });
});
