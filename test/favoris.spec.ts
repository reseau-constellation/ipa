import { isElectron, isNode } from "wherearewe";

import { expect } from "aegir/chai";

import { obtenir } from "./v2/utils.js";
import type {
  ÉpingleCompte,
  BooléenniserPropriétés,
  ÉpingleBd,
  ÉpingleFavoris,
  ÉpingleFavorisAvecId,
} from "@/favoris.js";
import { INSTALLÉ, TOUS } from "@/favoris.js";

describe("Favoris", function () {
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
        ({ siNonDéfini }) =>
          client.favoris.suivreEstÉpingléSurDispositif({
            idObjet: idBd,
            f: siNonDéfini(),
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
