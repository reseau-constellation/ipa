import { isElectron, isElectronMain, isNode } from "wherearewe";

import { constellation as utilsTestConstellation } from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { obtenir } from "@constl/utils-ipa";
import { créerConstellation, type Constellation } from "@/index.js";
import {
  INSTALLÉ,
  TOUS,
  ÉpingleCompte,
  type BooléenniserPropriétés,
  type ÉpingleBd,
  type ÉpingleFavoris,
  type ÉpingleFavorisAvecId,
} from "@/favoris.js";

const { créerConstellationsTest } = utilsTestConstellation;

describe("Favoris", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

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

    before(async () => {
      idBd = await client.bds.créerBd({ licence: "ODbl-1_0", épingler: false });
    });

    it("Juste un favori (notre propre compte) pour commencer", async () => {
      const val = await obtenir<ÉpingleFavorisAvecId[]>(({ siDéfini }) =>
        client.favoris.suivreFavoris({
          f: siDéfini(),
        }),
      );

      const monCompte = await client.obtIdCompte();
      const ref: ÉpingleFavorisAvecId<ÉpingleCompte> = {
        idObjet: monCompte,
        épingle: {
          type: "compte",
          base: TOUS,
          profil: {
            type: "profil",
            base: TOUS,
            fichiers: TOUS,
          },
          favoris: TOUS,
        },
      };
      expect(val).to.have.deep.members([ref]);
    });

    it("Ajouter un favori", async () => {
      await client.bds.épinglerBd({ idBd });
      const favoris = await obtenir<ÉpingleFavorisAvecId[]>(({ si }) =>
        client.favoris.suivreFavoris({
          f: si((x) => !!x.find((fv) => fv.idObjet === idBd)),
        }),
      );

      const réf: ÉpingleFavorisAvecId<ÉpingleBd> = {
        idObjet: idBd,
        épingle: {
          type: "bd",
          base: TOUS,
          données: {
            tableaux: TOUS,
            fichiers: INSTALLÉ,
          },
        },
      };
      expect(favoris.find((fv) => fv.idObjet === idBd)).to.deep.equal(réf);

      const valÉpingleBd = await obtenir<
        BooléenniserPropriétés<ÉpingleFavoris> | undefined
      >(({ siDéfini }) =>
        client.favoris.suivreEstÉpingléSurDispositif({
          idObjet: idBd,
          f: siDéfini(),
        }),
      );

      const réfÉpingle: BooléenniserPropriétés<ÉpingleBd> = {
        base: true,
        données: {
          tableaux: true,
          fichiers: isElectron || isNode,
        },
      };

      expect(valÉpingleBd).to.deep.equal(réfÉpingle);
    });

    it("Enlever un favori", async () => {
      await client.favoris.désépinglerFavori({ idObjet: idBd });

      const favoris = await obtenir<ÉpingleFavorisAvecId[]>(({ si }) =>
        client.favoris.suivreFavoris({
          f: si((x) => !x.find((fv) => fv.idObjet === idBd)),
        }),
      );
      expect(favoris.length).to.equal(1);

      await obtenir<BooléenniserPropriétés<ÉpingleFavoris> | undefined>(
        ({ si }) =>
          client.favoris.suivreEstÉpingléSurDispositif({
            idObjet: idBd,
            f: si((x) => x === undefined),
          }),
      );
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

      expect(client.épingles.estÉpinglé({ id: idc }));
    });
  });
});
