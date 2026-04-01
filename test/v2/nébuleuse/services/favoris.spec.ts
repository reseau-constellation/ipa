import { expect } from "aegir/chai";
import { isNode, isElectronMain } from "wherearewe";
import { faisRien } from "@constl/utils-ipa";
import {
  TOUS_DISPOSITIFS,
  type DispositifsÉpingle,
  type Réplication,
  type Résolveur,
  type ÉpingleFavorisAvecId,
  type ÉpingleFavorisBooléenniséeAvecId,
} from "@/v2/nébuleuse/services/favoris.js";
import { enleverPréfixes } from "@/v2/utils.js";
import { obtenir } from "../../utils.js";
import { créerNébuleusesTest } from "../utils.js";
import type { NébuleuseTest } from "../utils.js";
import type { Oublier, Suivi } from "@/v2/nébuleuse/types.js";

describe.only("Favoris", function () {
  let nébuleuses: NébuleuseTest[];
  let nébuleuse: NébuleuseTest;
  let fermer: () => Promise<void>;

  let idDispositif: string;

  type ÉpingleTest = {
    type: "test";
    épingle: {
      base: DispositifsÉpingle;
    };
  };
  const idObjet =
    "/typeobjet/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";
  const erreurs: string[] = [];

  before(async () => {
    ({ fermer, nébuleuses } = await créerNébuleusesTest({
      n: 2,
      options: {
        services: {
          journal: {
            f: (erreur) => {
              erreurs.push(erreur);
            },
          },
        },
      },
    }));
    nébuleuse = nébuleuses[0];

    idDispositif = await nébuleuse.compte.obtIdDispositif();
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("épingler sur dispositifs", function () {
    it("tous", async () => {
      const épinglé = await nébuleuse.favoris.estÉpingléSurDispositif({
        dispositifs: "TOUS",
      });
      expect(épinglé).to.be.true();
    });

    it("installés", async () => {
      const épinglé = await nébuleuse.favoris.estÉpingléSurDispositif({
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
      const épinglé = await nébuleuse.favoris.estÉpingléSurDispositif({
        dispositifs: "INSTALLÉ",
        idDispositif: idDispositifAutre,
      });
      expect(épinglé).to.be.false();
    });

    it("spécifiques - unique", async () => {
      const idDispositif = await nébuleuse.compte.obtIdDispositif();
      const épinglé = await nébuleuse.favoris.estÉpingléSurDispositif({
        dispositifs: idDispositif,
      });
      expect(épinglé).to.be.true();
    });

    it("spécifiques - liste", async () => {
      const idDispositif = await nébuleuse.compte.obtIdDispositif();
      const épinglé = await nébuleuse.favoris.estÉpingléSurDispositif({
        dispositifs: [idDispositif],
      });
      expect(épinglé).to.be.true();
    });
  });

  describe("résolution épingles", function () {
    it("inscrire résolution", async () => {
      const résolution: Résolveur<ÉpingleTest> = async ({
        épingle,
        f,
      }: {
        épingle: ÉpingleFavorisBooléenniséeAvecId<ÉpingleTest>;
        f: Suivi<Set<string>>;
      }): Promise<Oublier> => {
        await f(new Set(épingle.épingle.épingle.base  && épingle.idObjet ? [enleverPréfixes(épingle.idObjet)] : []));
        return faisRien;
      };

      await nébuleuse.favoris.inscrireRésolution({
        clef: "test",
        résolution,
      });

      const épingle: ÉpingleFavorisAvecId<ÉpingleTest["épingle"]> = {
        idObjet,
        épingle: {
          type: "test",
          épingle: {
            base: idDispositif,
          },
        },
      };
      const résolus = await obtenir<Set<string>>(({ siDéfini }) =>
        nébuleuse.favoris.suivreRésolutionÉpingle({
          épingle,
          f: siDéfini(),
        }),
      );

      expect([...résolus]).to.have.members([enleverPréfixes(idObjet)]);
    });

    it("erreur si résolution non inscrite", async () => {
      const résolus = await obtenir<Set<string>>(({ siDéfini }) =>
        nébuleuse.favoris.suivreRésolutionÉpingle({
          épingle: {
            idObjet,
            épingle: { type: "INEXISTANTE" },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolus]).to.have.members([enleverPréfixes(idObjet)]);
      expect(erreurs).to.include(
        "Résolveur pour épingle de type INEXISTANTE non disponible. Cet objet ne sera probablement pas épinglé.\n",
      );
    });

    it.skip("pas d'erreur même si référence circulaire", async () => {
      throw new Error("à faire");
    });
  });

  describe("gestion favoris", function () {
    it("épingler favoris", async () => {
      await nébuleuse.favoris.épinglerFavori({
        idObjet,
        épingle: {
          type: "test",
          épingle: {
            base: TOUS_DISPOSITIFS,
          },
        },
      });
      const favoris = await obtenir<ÉpingleFavorisAvecId[] | undefined>(
        ({ siPasVide }) =>
          nébuleuse.favoris.suivreFavoris({
            f: siPasVide(),
          }),
      );

      const réf: ÉpingleFavorisAvecId[] = [
        {
          idObjet,
          épingle: {
            type: "test",
            épingle: {
              base: TOUS_DISPOSITIFS,
            },
          },
        },
      ];
      expect(favoris).to.deep.equal(réf);
    });

    it("bien épinglé", async () => {
      // `estÉpinglé` ne fonctionne pas si l'objet n'est pas disponible à OrbitDB.
      const épinglé = [...nébuleuse.services.épingles.requêtes].find(r=>r[1].has(enleverPréfixes(idObjet)));
      expect(épinglé).to.not.be.undefined();
    });

    it("détecter sur autre compte", async () => {
      const idCompte1 = await nébuleuses[0].compte.obtIdCompte()
      const favoris = await obtenir<ÉpingleFavorisAvecId[] | undefined>(
        ({ siPasVide }) =>
          nébuleuses[1].favoris.suivreFavoris({
            f: siPasVide(),
            idCompte: idCompte1,
          }),
      );

      const réf: ÉpingleFavorisAvecId<ÉpingleTest["épingle"]>[] = [
        {
          idObjet,
          épingle: {
            type: "test",
            épingle: {
              base: TOUS_DISPOSITIFS,
            },
          },
        },
      ];
      expect(favoris).to.deep.equal(réf);
    });

    it.skip("rechercher épingles objet", async () => {
      const épingles = await obtenir<
        {
          idCompte: string;
          épingle: ÉpingleFavorisAvecId;
        }[]
      >(({ siPasVide }) =>
        nébuleuses[1].favoris.suivreÉpinglesObjet({
          idObjet,
          f: siPasVide(),
        }),
      );

      const réf: {
        idCompte: string;
        épingle: ÉpingleFavorisAvecId<ÉpingleTest["épingle"]>;
      }[] = [
        {
          idCompte: await nébuleuse.compte.obtIdCompte(),
          épingle: {
            idObjet,
            épingle: {
              type: "test",
              épingle: {
                base: TOUS_DISPOSITIFS,
              },
            },
          },
        },
      ];
      expect(épingles).to.have.deep.members(réf);
    });

    it.skip("rechercher réplications objet", async () => {
      const réplications = await obtenir<Réplication[]>(({ siPasVide }) =>
        nébuleuses[1].favoris.suivreRéplications({
          idObjet,
          f: siPasVide(),
        }),
      );

      const réf: Réplication<ÉpingleTest["épingle"]>[] = [
        {
          idDispositif: await nébuleuse.compte.obtIdDispositif(),
          épingle: {
            type: "test",
            épingle: {
              base: TOUS_DISPOSITIFS,
            },
          },
        },
      ];
      expect(réplications).to.have.deep.members(réf);
    });

    it("désépingler favoris", async () => {
      await nébuleuse.favoris.désépinglerFavori({ idObjet });

      const favoris = await obtenir<ÉpingleFavorisAvecId[] | undefined>(
        ({ si }) =>
          nébuleuse.favoris.suivreFavoris({
            f: si(fav=>!!fav && !fav?.find(f=>f.idObjet === idObjet)),
          }),
      );

      expect(favoris).to.be.empty();
    });
  });
});
