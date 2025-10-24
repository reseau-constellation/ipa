import { expect } from "aegir/chai";
import {
  RésultatProfondeur,
  cacheRechercheParN,
  cacheRechercheParProfondeur,
  cacheSuivi,
} from "@/décorateursCache.js";
import { Suivi, Oublier, RetourRecherche } from "@/v2/crabe/types.js";
import { attendreQue } from "../nébuleuse/utils/fonctions.js";

describe.only("Cache", function () {
  describe("suivi", function () {
    let test: Test;
    let nAppels = 0;
    let àOublier: Oublier[] = [];

    const appelOublié = new Set();

    class Test {
      @cacheSuivi
      async suivi<T>({ a, f }: { a: T; f: Suivi<T> }): Promise<Oublier> {
        nAppels++;
        await f(a);
        return async () => {
          appelOublié.add(a);
        };
      }

      @cacheSuivi
      async sansFonction({}: { a: number }): Promise<Oublier> {
        return async () => {};
      }

      @cacheSuivi
      async sansArguments(): Promise<Oublier> {
        return async () => {};
      }

      @cacheSuivi
      async deuxFonctions<T>({
        a,
        f1,
        f2,
      }: {
        a: T;
        f1: Suivi<T>;
        f2: Suivi<T>;
      }): Promise<Oublier> {
        await f1(a);
        await f2(a);
        return async () => {};
      }

      @cacheSuivi
      async argsMultiples<T>(a: T, f: Suivi<T>): Promise<Oublier> {
        await f(a);
        return async () => {};
      }
    }

    beforeEach(async () => {
      test = new Test();
    });

    afterEach(async () => {
      nAppels = 0;
      await Promise.all(àOublier.map((f) => f()));
      appelOublié.clear();
      àOublier = [];
    });

    it("fonction appellée une fois pour les mêmes paramètres", async () => {
      let val1 = 0;
      let val2 = 0;
      àOublier.push(
        await test.suivi({
          a: 1,
          f: (x) => {
            val1 = x;
          },
        }),
      );

      àOublier.push(
        await test.suivi({
          a: 1,
          f: (x) => {
            val2 = x;
          },
        }),
      );

      expect(val1).to.equal(1);
      expect(val2).to.equal(1);
      expect(nAppels).to.equal(1);
    });

    it("`oublier` appellé que lors de la fermeture du dernier suivi", async () => {
      const oublier1 = await test.suivi({ a: 1, f: () => {} });
      const oublier2 = await test.suivi({ a: 1, f: () => {} });

      await oublier1();
      expect(appelOublié).to.be.empty();

      await oublier2();
      expect([...appelOublié]).to.have.same.members([1]);
    });

    it("fonction appellée avec des différents paramètres", async () => {
      let val1 = 0;
      let val2 = 0;

      const oublier1 = await test.suivi({
        a: 1,
        f: (x) => {
          val1 = x;
        },
      });
      àOublier.push(
        await test.suivi({
          a: 2,
          f: (x) => {
            val2 = x;
          },
        }),
      );

      await oublier1();

      expect(val1).to.equal(1);
      expect(val2).to.equal(2);
      expect(nAppels).to.equal(2);
    });

    it("`oublier` n'affecte pas les cas appellés avec des différents paramètres", async () => {
      const oublier1 = await test.suivi({ a: 1, f: () => {} });
      const oublier2 = await test.suivi({ a: 2, f: () => {} });

      await oublier1();
      expect([...appelOublié]).to.have.same.members([1]);

      await oublier2();
      expect([...appelOublié]).to.have.same.members([1, 2]);
    });

    it("erreur si plus qu'un argument n'est une fonction", async () => {
      await expect(
        test.deuxFonctions({ a: 1, f1: () => {}, f2: () => {} }),
      ).to.eventually.be.rejectedWith(
        `Plus d'un argument pour Test.deuxFonctions est une fonction : f1, f2`,
      );
    });

    it("erreur si aucun argument n'est une fonction", async () => {
      await expect(test.sansFonction({ a: 1 })).to.eventually.be.rejectedWith(
        `Aucun argument pour Test.sansFonction n'est une fonction.`,
      );
    });

    it("erreur si aucun argument du tout", async () => {
      await expect(test.sansArguments()).to.eventually.be.rejectedWith(
        `La fonction Test.sansArguments n'a pas d'arguments.`,
      );
    });

    it("erreur si les arguments ne sont pas regroupés dans un objet", async () => {
      await expect(
        test.argsMultiples(1, () => {}),
      ).to.eventually.be.rejectedWith(
        `Les arguments de Test.argsMultiples doivent être regroupés dans un seul objet {}.`,
      );
    });
  });

  describe("recherche", function () {
    let test: Test;
    let nAppels = 0;
    let appelléeAvec: { a?: unknown; n?: number } = {};

    let àOublier: Oublier[] = [];

    const appelOublié = new Set();

    class Test {
      fibonnaci(n: number): number[] {
        let a = 0,
          b = 1,
          c = 0;
        const fib = [a, b];
        for (let i = 2; i < n; i++) {
          c = a + b;
          fib.push(c);
          a = b;
          b = c;
        }
        return fib;
      }

      @cacheRechercheParN
      async recherche({
        a,
        f,
        n,
      }: {
        a: string;
        f: Suivi<number[]>;
        n?: number;
      }): Promise<RetourRecherche> {
        nAppels++;
        appelléeAvec = { a, n };
        if (n === undefined || n === Infinity) n = 15;
        await f(this.fibonnaci(n));

        return {
          oublier: async () => {
            appelOublié.add(a);
          },
          n: (n: number) => f(this.fibonnaci(n)),
        };
      }

      @cacheRechercheParN
      async sansFonction({}: { a: number }): Promise<Oublier> {
        return async () => {};
      }

      @cacheRechercheParN
      async sansArguments(): Promise<Oublier> {
        return async () => {};
      }

      @cacheRechercheParN
      async deuxFonctions<T>({
        a,
        f1,
        f2,
      }: {
        a: T;
        f1: Suivi<T>;
        f2: Suivi<T>;
      }): Promise<Oublier> {
        await f1(a);
        await f2(a);
        return async () => {};
      }

      @cacheRechercheParN
      async argsMultiples<T>(a: T, f: Suivi<T>): Promise<Oublier> {
        await f(a);
        return async () => {};
      }

      @cacheRechercheParProfondeur
      async parProfondeur<T>({
        a,
        f,
        n,
      }: {
        a: T;
        f: Suivi<RésultatProfondeur<T>[]>;
        n: number;
      }): Promise<RetourRecherche> {
        const générerDonnées = (n_: number) => {
          const liste = Array(n_)
            .fill(0)
            .map((_, i) => ({ profondeur: i, val: a }));
          return liste.reduce<RésultatProfondeur<T>[]>(
            (a, i) => a.concat(i, i),
            [],
          );
        };

        await f(générerDonnées(n));

        return {
          oublier: async () => {
            appelOublié.add(a);
          },
          n: (n: number) => f(générerDonnées(n)),
        };
      }
    }

    beforeEach(async () => {
      test = new Test();
    });

    afterEach(async () => {
      nAppels = 0;
      await Promise.all(àOublier.map((f) => f()));
      appelOublié.clear();
      àOublier = [];
    });

    it("fonction appellée une fois pour les mêmes paramètres", async () => {
      let val1: number[] = [];
      let val2: number[] = [];
      const { oublier: oublier1 } = await test.recherche({
        a: "a",
        f: (x) => {
          val1 = x;
        },
        n: 5,
      });

      àOublier.push(oublier1);

      const { oublier: oublier2 } = await test.recherche({
        a: "a",
        f: (x) => {
          val2 = x;
        },
        n: 5,
      });
      àOublier.push(oublier2);

      expect(val1).to.deep.equal([0, 1, 1, 2, 3]);
      expect(val2).to.deep.equal([0, 1, 1, 2, 3]);
      expect(nAppels).to.equal(1);
    });

    it("fonction appellée une fois même si la taille diffère", async () => {
      let val1: number[] = [];
      let val2: number[] = [];

      const { oublier: oublier1 } = await test.recherche({
        a: "a",
        f: (x) => {
          val1 = x;
        },
        n: 5,
      });

      àOublier.push(oublier1);

      const { oublier: oublier2 } = await test.recherche({
        a: "a",
        f: (x) => {
          val2 = x;
        },
        n: 7,
      });
      àOublier.push(oublier2);

      expect(val1).to.deep.equal([0, 1, 1, 2, 3]);

      expect(val2).to.deep.equal([0, 1, 1, 2, 3, 5, 8]);
      expect(nAppels).to.equal(1);
    });

    it("`oublier` appellée que lors de la fermeture du dernier suivi", async () => {
      const { oublier: oublier1 } = await test.recherche({
        a: "a",
        f: () => {},
        n: 5,
      });

      const { oublier: oublier2 } = await test.recherche({
        a: "a",
        f: () => {},
        n: 7,
      });

      await oublier1();
      expect(appelOublié).to.not.contain("a");

      await oublier2();
      expect(appelOublié).to.contain("a");
    });

    it("fonction appellée avec des différents paramètres", async () => {
      let val1: number[] = [];
      let val2: number[] = [];

      const { oublier: oublier1 } = await test.recherche({
        a: "a",
        f: (x) => {
          val1 = x;
        },
        n: 5,
      });

      àOublier.push(oublier1);

      const { oublier: oublier2 } = await test.recherche({
        a: "b",
        f: (x) => {
          val2 = x;
        },
        n: 6,
      });

      àOublier.push(oublier2);

      expect(val1).to.deep.equal([0, 1, 1, 2, 3]);
      expect(val2).to.deep.equal([0, 1, 1, 2, 3, 5]);
      expect(nAppels).to.equal(2);
    });

    it("fonction appellée sans paramètre taille", async () => {
      let val: number[] = [];

      const { oublier } = await test.recherche({
        a: "a",
        f: (x) => {
          val = x;
        },
      });
      àOublier.push(oublier);

      expect(appelléeAvec.n).to.equal(Infinity);
      expect(val).to.deep.equal([
        0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377,
      ]);
    });

    it("`oublier` n'affecte pas les cas appellés avec des différents paramètres", async () => {
      let val2: number[] = [];

      const { oublier: oublier1 } = await test.recherche({
        a: "a",
        f: () => {},
        n: 5,
      });

      const { oublier: oublier2, n: n2 } = await test.recherche({
        a: "b",
        f: (x) => {
          val2 = x;
        },
        n: 7,
      });
      àOublier.push(oublier2);

      await oublier1();
      expect(appelOublié).to.contain("a");
      expect(appelOublié).to.not.contain("b");

      n2(4);
      await attendreQue(() => val2.length === 4);
    });

    it("augmentation de la taille de recherche", async () => {
      let val1: number[] = [];

      const { oublier, n } = await test.recherche({
        a: "a",
        f: (x) => {
          val1 = x;
        },
        n: 5,
      });
      àOublier.push(oublier);

      n(8);
      await attendreQue(() => val1.length === 8);

      expect(val1).to.deep.equal([0, 1, 1, 2, 3, 5, 8, 13]);
      // L'augmentation de la taille passe par un appel à `n()` et non à la fonction originale
      expect(nAppels).to.equal(1);
    });

    it("augmentation de la taille de recherche n'affect pas les autres appels", async () => {
      let val1: number[] = [];
      let val2: number[] = [];

      const { oublier: oublier1, n: n1 } = await test.recherche({
        a: "a",
        f: (x) => {
          val1 = x;
        },
        n: 5,
      });
      àOublier.push(oublier1);

      const { oublier: oublier2 } = await test.recherche({
        a: "a",
        f: (x) => {
          val2 = x;
        },
        n: 5,
      });
      àOublier.push(oublier2);

      n1(8);
      await attendreQue(() => val1.length === 8);

      expect(val2).to.deep.equal([0, 1, 1, 2, 3]);
      // L'augmentation de la taille passe par un appel à `n()` et non à la fonction originale
      expect(nAppels).to.equal(1);
    });

    it("diminution de la taille de recherche n'affecte pas les autres appels", async () => {
      let val1: number[] = [];
      let val2: number[] = [];

      const { oublier: oublier1, n: n1 } = await test.recherche({
        a: "a",
        f: (x) => {
          val1 = x;
        },
        n: 5,
      });
      àOublier.push(oublier1);

      const { oublier: oublier2 } = await test.recherche({
        a: "a",
        f: (x) => {
          val2 = x;
        },
        n: 5,
      });
      àOublier.push(oublier2);

      n1(3);
      await attendreQue(() => val1.length === 3);

      expect(val2).to.deep.equal([0, 1, 1, 2, 3]);
      expect(nAppels).to.equal(1);
    });

    it("par profondeur", async () => {
      let val: RésultatProfondeur<string>[] = [];

      const { oublier, n } = await test.parProfondeur({
        a: "a",
        f: (x) => {
          val = x;
        },
        n: 5,
      });
      àOublier.push(oublier);

      expect(val.map((x) => x.val)).to.deep.equal(Array(10).fill("a"));
      n(3);
      await attendreQue(() => val.length === 6);

      expect(val.every((v) => v.profondeur <= 3));
    });

    it("erreur si plus qu'un argument est une fonction", async () => {
      await expect(
        test.deuxFonctions({ a: 1, f1: () => {}, f2: () => {} }),
      ).to.eventually.be.rejectedWith(
        `Plus d'un argument pour Test.deuxFonctions est une fonction : f1, f2`,
      );
    });

    it("erreur si aucun argument n'est une fonction", async () => {
      await expect(test.sansFonction({ a: 1 })).to.eventually.be.rejectedWith(
        `Aucun argument pour Test.sansFonction n'est une fonction.`,
      );
    });

    it("erreur si la fonction n'a pas d'arguments", async () => {
      await expect(test.sansArguments()).to.eventually.be.rejectedWith(
        `La fonction Test.sansArguments n'a pas d'arguments.`,
      );
    });

    it("erreur si les arguments ne sont pas regroupés dans un objet", async () => {
      await expect(
        test.argsMultiples(1, () => {}),
      ).to.eventually.be.rejectedWith(
        `Les arguments de Test.argsMultiples doivent être regroupés dans un seul objet {}.`,
      );
    });
  });
});
