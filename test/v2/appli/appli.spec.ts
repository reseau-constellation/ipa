import { expect } from "aegir/chai";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";
import { ServiceAppli } from "@/v2/nébuleuse/appli/index.js";
import type {
  OptionsAppli,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";

describe.only("Appli", function () {
  describe("Démarrage", function () {
    it("Démarrer sans services", async () => {
      const appli = new Appli({ services: {} });
      await appli.démarrer();
      expect(appli.estDémarrée).to.be.true();
    });

    it("Services démarrés en ordre", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
        c: ServiceC;
      };

      class ServiceA extends ServiceAppli<"a"> {
        dépendances = [];

        constructor({ options }: { options: OptionsAppli }) {
          super({
            clef: "a",
            services: {},
            options,
          });
        }
      }

      class ServiceB extends ServiceAppli<"b", { a: ServiceA }> {
        constructor({
          services,
          options,
        }: {
          services: { a: ServiceA };
          options: OptionsAppli;
        }) {
          super({
            clef: "b",
            services,
            options,
            dépendances: ["a"],
          });
        }
      }

      class ServiceC extends ServiceAppli<"c", { a: ServiceA; b: ServiceB }> {
        constructor({
          services,
          options,
        }: {
          services: { a: ServiceA; b: ServiceB };
          options: OptionsAppli;
        }) {
          super({
            clef: "c",
            services,
            options,
            dépendances: ["a", "b"],
          });
        }
      }

      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options }) => new ServiceA({ options }),
          b: ({ options, services }) => new ServiceB({ options, services }),
          c: ({ options, services }) => new ServiceC({ options, services }),
        },
      });
      await appli.démarrer();
      expect(appli.estDémarrée).to.be.true();
    });

    it("Services bien démarrés lorsque Appli est démarrée", async () => {
      type ServicesTest = {
        a: ServiceA;
      };

      class ServiceA extends ServiceAppli {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsAppli;
        }) {
          super({
            clef: "a",
            services,
            options,
          });
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options, services }) => new ServiceA({ options, services }),
        },
      });
      appli.démarrer();
      await appli.démarrée();

      expect(
        Object.values(appli.services).every((s) => s.estDémarré),
      ).to.be.true();
    });

    it("Erreur lorsque dépendances circulaires", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceAppli<"a", { b: ServiceB }> {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsAppli;
        }) {
          super({
            clef: "a",
            services,
            dépendances: ["b"],
            options,
          });
        }
      }
      class ServiceB extends ServiceAppli<"b", { a: ServiceA }> {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsAppli;
        }) {
          super({
            clef: "b",
            services,
            dépendances: ["a"],
            options,
          });
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options, services }) => new ServiceA({ options, services }),
          b: ({ options, services }) => new ServiceB({ options, services }),
        },
      });

      await expect(appli.démarrer()).to.eventually.be.rejectedWith(
        "circulaire",
      );
    });
  });

  describe("fermer", function () {
    it("fermer sans services", async () => {
      const appli = new Appli({ services: {} });
      await appli.démarrer();
      await appli.fermer();
      expect(appli.estDémarrée).to.be.false();
    });

    it("services fermés en ordre", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
        c: ServiceC;
      };
      class ServiceA extends ServiceAppli {
        // Il faut inclure l'options `services` pour pouvoir tester la fermeture des autres services 
        // dans `fermer` par la suite.
        constructor({ options, services }: { options: OptionsAppli; services: ServicesAppli }) {
          super({
            clef: "a",
            services: services,
            options,
          });
        }
        async fermer(): Promise<void> {
          // Accéder services b et c qui ne sont pas dans les dépendances de a
          expect(this.services["b"].estDémarré).to.be.false();
          expect(this.services["c"].estDémarré).to.be.false();
          return await super.fermer();
        }
      }

      class ServiceB extends ServiceAppli<"b", { a: ServiceA }> {
        constructor({
          services,
          options,
        }: {
          services: { a: ServiceA };
          options: OptionsAppli;
        }) {
          super({
            clef: "b",
            services,
            dépendances: ["a"],
            options,
          });
        }
        async fermer(): Promise<void> {
          expect(this.service("a").estDémarré).to.be.true();

          // @ts-expect-error Accéder services["c"] qui n'est pas dans les dépendances de b
          expect(this.services["c"].estDémarré).to.be.false();
          return await super.fermer();
        }
      }
      class ServiceC extends ServiceAppli<"c", ServicesTest> {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsAppli;
        }) {
          super({
            clef: "c",
            services,
            dépendances: ["a", "b"],
            options,
          });
        }

        async fermer(): Promise<void> {
          expect(this.service("a").estDémarré).to.be.true();
          expect(this.service("b").estDémarré).to.be.true();
          return await super.fermer();
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options, services }) => new ServiceA({ options, services }),
          b: ({ options, services }) => new ServiceB({ options, services }),
          c: ({ options, services }) => new ServiceC({ options, services }),
        },
      });
      await appli.démarrer();
      await appli.fermer();
    });

    it("services bien fermés lorsque Appli est fermée", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsAppli;
        }) {
          super({
            clef: "a",
            services,
            options,
          });
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options, services }) => new ServiceA({ options, services }),
        },
      });
      await appli.démarrer();
      await appli.fermer();

      expect(
        Object.values(appli.services).every((s) => !s.estDémarré),
      ).to.be.true();
    });

    it("attendre démarré avant de fermer", async () => {
      let appliFutDémareée = false;

      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceAppli<"a"> {
        constructor({ options }: { options: OptionsAppli }) {
          super({
            clef: "a",
            services: {},
            options,
          });
        }

        async démarrer() {
          // Un tout petit délai
          await new Promise((résoudre) => setTimeout(résoudre, 25));
          return await super.démarrer();
        }

        async fermer(): Promise<void> {
          expect(this.estDémarré).to.be.true();
          expect(appliFutDémareée).to.be.true();
          return await super.fermer();
        }
      }

      class AppliTest extends Appli<ServicesTest> {
        async démarrer(): Promise<void> {
          const retour = await super.démarrer();
          appliFutDémareée = true;
          return retour;
        }

        async fermer(): Promise<void> {
          return await super.fermer();
        }
      }
      const appli = new AppliTest({
        services: {
          a: ({ options }) => new ServiceA({ options }),
        },
      });
      appli.démarrer(); // On n'attend pas avant de fermer
      await appli.fermer();
    });

    it("erreur lorsque dépendances circulaires", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceAppli<"a", { b: ServiceB }> {
        constructor({
          services,
          options,
        }: {
          services: { b: ServiceB };
          options: OptionsAppli;
        }) {
          super({
            clef: "a",
            services,
            dépendances: ["b"],
            options,
          });
        }
      }
      class ServiceB extends ServiceAppli<"b"> {
        constructor({
          services,
          options,
        }: {
          services: ServicesAppli;
          options: OptionsAppli;
        }) {
          super({
            clef: "b",
            services,
            dépendances: [],
            options,
          });
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options, services }) => new ServiceA({ options, services }),
          b: ({ options, services }) => new ServiceB({ options, services }),
        },
      });
      await appli.démarrer();

      // Créer dépendance circulaire
      appli.services["b"].dépendances = ["a"];

      await expect(appli.fermer()).to.eventually.be.rejectedWith("circulaire");
    });

    it("fermer lorsque déjà fermée", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceAppli<"a"> {
        constructor({ options }: { options: OptionsAppli }) {
          super({
            clef: "a",
            services: {},
            options,
          });
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options }) => new ServiceA({ options }),
        },
      });
      await appli.démarrer();
      await appli.fermer();

      // Fermer à nouveau
      await appli.fermer();

      expect(
        Object.values(appli.services).every((s) => !s.estDémarré),
      ).to.be.true();
      expect(appli.estDémarrée).to.be.false();
    });

    it("erreur de fermeture service", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsAppli;
        }) {
          super({
            clef: "a",
            services,
            options,
          });
        }
        fermer(): Promise<void> {
          throw new Error("erreur de fermeture");
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options, services }) => new ServiceA({ options, services }),
        },
      });
      await appli.démarrer();

      await expect(appli.fermer()).to.eventually.be.rejectedWith(
        "erreur de fermeture",
      );
    });

    it("fermeture après erreur de démarrage service", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceAppli<"a"> {
        constructor({ options }: { options: OptionsAppli }) {
          super({
            clef: "a",
            services: {},
            options,
          });
        }
        démarrer(): Promise<void> {
          throw new Error("erreur de démarrage");
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options }) => new ServiceA({ options }),
        },
      });
      try {
        await appli.démarrer();
      } catch {
        await expect(appli.fermer()).to.eventually.be.rejectedWith(
          "Erreur de démarrage",
        );
      }
    });
  });

  describe("Communication entre services", function () {
    it("Accès dépendance", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceAppli {
        constructor({ options }: { options: OptionsAppli }) {
          super({
            clef: "a",
            services: {},
            options,
          });
        }
        fonction() {
          return 3;
        }
      }
      class ServiceB extends ServiceAppli<"b", { a: ServiceA }> {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsAppli;
        }) {
          super({
            clef: "b",
            services,
            dépendances: ["a"],
            options,
          });
        }
        async démarrer() {
          expect(this.service("a").fonction()).to.equal(3);
          return super.démarrer();
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options }) => new ServiceA({ options }),
          b: ({ options, services }) => new ServiceB({ options, services }),
        },
      });
      await appli.démarrer();
    });

    it("Accès retour initialisation", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceAppli<"a", ServicesAppli, string> {
        constructor({ options }: { options: OptionsAppli }) {
          super({
            clef: "a",
            services: {},
            options,
          });
        }
        async démarrer() {
          this.estDémarré = "une valeur spéciale";
          return await super.démarrer();
        }
      }
      class ServiceB extends ServiceAppli<"b", { a: ServiceA }> {
        constructor({
          services,
          options,
        }: {
          services: { a: ServiceA };
          options: OptionsAppli;
        }) {
          super({
            clef: "b",
            services,
            dépendances: ["a"],
            options,
          });
        }
        async démarrer() {
          expect(await this.service("a").démarré()).to.equal(
            "une valeur spéciale",
          );
          return super.démarrer();
        }
      }

      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options }) => new ServiceA({ options }),
          b: ({ options, services }) => new ServiceB({ options, services }),
        },
      });
      await appli.démarrer();
    });

    it("erreur si dépendance non spécifiée", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsAppli;
        }) {
          super({
            clef: "a",
            services,
            options,
          });
        }
        fonction() {
          return 3;
        }
      }
      class ServiceB extends ServiceAppli<"b", ServicesTest> {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsAppli;
        }) {
          super({
            clef: "b",
            services,
            options,
          });
        }

        async démarrer() {
          return super.démarrer();
        }

        async accéderA() {
          return this.service("a").fonction();
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options, services }) => new ServiceA({ options, services }),
          b: ({ options, services }) => new ServiceB({ options, services }),
        },
      });
      await appli.démarrer();

      expect(appli.services["b"].accéderA()).to.be.rejectedWith(
        "n'est pas spécifié parmi les dépendences",
      );
    });
  });

  describe("Options d'initialisation", function () {
    it("accès aux options d'initialisation", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      type OptionsServiceA = { a?: number };
      type OptionsServiceB = { b?: number };

      class ServiceA extends ServiceAppli<
        "a",
        ServicesAppli,
        unknown,
        OptionsServiceA
      > {
        constructor({
          services,
          options,
        }: {
          services: { a: ServiceA };
          options: OptionsServiceA & OptionsAppli;
        }) {
          super({
            clef: "a",
            services,
            options,
          });
        }

        async démarrer() {
          expect(this.options.a).to.equal(8);
          return super.démarrer();
        }
      }

      class ServiceB extends ServiceAppli<
        "b",
        ServicesTest,
        unknown,
        OptionsServiceB
      > {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsServiceB & OptionsAppli;
        }) {
          super({
            clef: "b",
            services,
            dépendances: ["a"],
            options,
          });
        }
        async démarrer() {
          expect(this.options.b).to.equal(7);
          return super.démarrer();
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options, services }) =>
            new ServiceA({ options: { a: 8, ...options }, services }),
          b: ({ options, services }) =>
            new ServiceB({ options: { b: 7, ...options }, services }),
        },
      });

      await appli.démarrer();
    });

    it("Service A dépendant de service B", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      type OptionsServiceA = { a?: number };
      type OptionsServiceB = { b?: number };

      class ServiceA extends ServiceAppli<
        "a",
        { a: ServiceA },
        unknown,
        OptionsServiceA
      > {
        constructor({
          services,
          options,
        }: {
          services: { a: ServiceA };
          options: OptionsServiceA & OptionsAppli;
        }) {
          super({
            clef: "a",
            services,
            options,
          });
        }

        async démarrer() {
          expect(this.options.a).to.equal(8);
          return super.démarrer();
        }
      }

      class ServiceB extends ServiceAppli<
        "b",
        ServicesTest,
        unknown,
        OptionsServiceB
      > {
        constructor({
          services,
          options,
        }: {
          services: ServicesTest;
          options: OptionsServiceB & OptionsAppli;
        }) {
          super({
            clef: "b",
            services,
            dépendances: ["a"],
            options,
          });
        }
        async démarrer() {
          expect(this.options.b).to.equal(7);
          return super.démarrer();
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ({ options, services }) =>
            new ServiceA({ options: { a: 8, ...options }, services }),
          b: ({ options, services }) =>
            new ServiceB({ options: { b: 7, ...options }, services }),
        },
      });

      await appli.démarrer();
    });
  });
});
