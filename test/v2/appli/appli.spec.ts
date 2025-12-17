import fs from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { isElectronMain, isNode } from "wherearewe";
import { Appli, ServiceAppli } from "@/v2/nébuleuse/appli/appli.js";
import { dossierTempoPropre } from "../utils.js";
import type { OptionsAppli, ServicesAppli } from "@/v2/nébuleuse/appli/appli.js";
import type Quibble from "quibble";

describe.only("Appli", function () {
  describe("Démarrage", function () {
    it("Démarrer sans services", async () => {
      const appli = new Appli();
      await appli.démarrer();
      expect(appli.estDémarrée).to.be.true();
    });

    it("Services démarrés en ordre", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
        c: ServiceC;
      };
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
          });
        }
      }
      class ServiceB extends ServiceAppli<"b", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "b",
            appli,
            dépendances: ["a"],
          });
        }
      }
      class ServiceC extends ServiceAppli<"c", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "c",
            appli,
            dépendances: ["a", "b"],
          });
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ServiceA,
          b: ServiceB,
          c: ServiceC,
        },
      });
      await appli.démarrer();
      expect(appli.estDémarrée).to.be.true();
    });

    it("Services bien démarrés lorsque Appli est démarrée", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
          });
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ServiceA,
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
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
            dépendances: ["b"],
          });
        }
      }
      class ServiceB extends ServiceAppli<"b", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "b",
            appli,
            dépendances: ["a"],
          });
        }
      }
      const appli = new Appli({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
      });

      await expect(appli.démarrer()).to.eventually.be.rejectedWith(
        "circulaire",
      );
    });
  });

  describe("Fermer", function () {
    it("Fermer sans services", async () => {
      const appli = new Appli();
      await appli.démarrer();
      await appli.fermer();
      expect(appli.estDémarrée).to.be.false();
    });

    it("Services fermés en ordre", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
        c: ServiceC;
      };
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
          });
        }
        async fermer(): Promise<void> {
          // Accéder services b et c qui ne sont pas dans les dépendances de a
          expect(this.appli.services["b"].estDémarré).to.be.false();
          expect(this.appli.services["c"].estDémarré).to.be.false();
          return await super.fermer();
        }
      }
      class ServiceB extends ServiceAppli<"b", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "b",
            appli,
            dépendances: ["a"],
          });
        }
        async fermer(): Promise<void> {
          expect(this.service("a").estDémarré).to.be.true();

          // Accéder services["c"] qui n'est pas dans les dépendances de b
          expect(this.appli.services["c"].estDémarré).to.be.false();
          return await super.fermer();
        }
      }
      class ServiceC extends ServiceAppli<"c", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "c",
            appli,
            dépendances: ["a", "b"],
          });
        }

        async fermer(): Promise<void> {
          expect(this.service("a").estDémarré).to.be.true();
          expect(this.service("b").estDémarré).to.be.true();
          return await super.fermer();
        }
      }
      const appli = new Appli({
        services: {
          a: ServiceA,
          b: ServiceB,
          c: ServiceC,
        },
      });
      await appli.démarrer();
      await appli.fermer();
    });

    it("Services bien fermés lorsque Appli est fermée", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
          });
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ServiceA,
        },
      });
      await appli.démarrer();
      await appli.fermer();

      expect(
        Object.values(appli.services).every((s) => !s.estDémarré),
      ).to.be.true();
    });

    it("Attendre démarré avant de fermer", async () => {
      let appliFutDémareée = false;

      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
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
          a: ServiceA,
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
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
            dépendances: ["b"],
          });
        }
      }
      class ServiceB extends ServiceAppli<"b", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "b",
            appli,
            dépendances: [],
          });
        }
      }
      const appli = new Appli({
        services: {
          a: ServiceA,
          b: ServiceB,
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
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
          });
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ServiceA,
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
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
          });
        }
        fermer(): Promise<void> {
          throw new Error("erreur de fermeture");
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ServiceA,
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
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
          });
        }
        démarrer(): Promise<void> {
          throw new Error("erreur de démarrage");
        }
      }
      const appli = new Appli<ServicesTest>({
        services: {
          a: ServiceA,
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
      class ServiceA extends ServiceAppli<"a", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
          });
        }
        fonction() {
          return 3;
        }
      }
      class ServiceB extends ServiceAppli<"b", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "b",
            appli,
            dépendances: ["a"],
          });
        }
        async démarrer() {
          expect(this.service("a").fonction()).to.equal(3);
          return super.démarrer();
        }
      }
      const appli = new Appli({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
      });
      await appli.démarrer();
    });

    it("Accès retour initialisation", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceAppli<"a", ServicesTest, string> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
          });
        }
        async démarrer() {
          this.estDémarré = "une valeur spéciale";
          return await super.démarrer();
        }
      }
      class ServiceB extends ServiceAppli<"b", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "b",
            appli,
            dépendances: ["a"],
          });
        }
        async démarrer() {
          expect(await this.service("a").démarré()).to.equal(
            "une valeur spéciale",
          );
          return super.démarrer();
        }
      }

      const appli = new Appli({
        services: {
          a: ServiceA,
          b: ServiceB,
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
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "a",
            appli,
          });
        }
        fonction() {
          return 3;
        }
      }
      class ServiceB extends ServiceAppli<"b", ServicesTest> {
        constructor({ appli }: { appli: Appli<ServicesTest> }) {
          super({
            clef: "b",
            appli,
          });
        }

        async démarrer() {
          return super.démarrer();
        }

        async accéderA() {
          return this.service("a").fonction();
        }
      }
      const appli = new Appli({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
      });
      await appli.démarrer();

      expect(appli.services["b"].accéderA()).to.be.rejectedWith(
        "n'est pas spécifié parmi les dépendences",
      );
    });
  });

  describe("Options d'initialisation", function () {
    it("Accès aux options d'initialisation", async () => {
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
          appli,
          options,
        }: {
          appli: Appli<{ a: ServiceA }>;
          options?: OptionsServiceA;
        }) {
          super({
            clef: "a",
            appli,
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
          appli,
          options,
        }: {
          appli: Appli<ServicesTest>;
          options?: OptionsServiceB;
        }) {
          super({
            clef: "b",
            appli,
            dépendances: ["a"],
            options,
          });
        }
        async démarrer() {
          expect(this.options.b).to.equal(7);
          return super.démarrer();
        }
      }
      const options = {
        services: {
          a: { a: 8 },
          b: { b: 7 },
        },
      };
      const appli = new Appli<ServicesTest>({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
        options,
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
          appli,
          options,
        }: {
          appli: Appli<{ a: ServiceA }>;
          options?: OptionsServiceA;
        }) {
          super({
            clef: "a",
            appli,
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
          appli,
          options,
        }: {
          appli: Appli<ServicesTest>;
          options?: OptionsServiceB;
        }) {
          super({
            clef: "b",
            appli,
            dépendances: ["a"],
            options,
          });
        }
        async démarrer() {
          expect(this.options.b).to.equal(7);
          return super.démarrer();
        }
      }
      const options: OptionsAppli<ServicesTest> = {
        services: {
          a: { a: 8 },
          b: { b: 7 },
        },
      };
      const appli = new Appli({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
        options,
      });

      await appli.démarrer();
    });
  });

  describe("Dossier", function () {
    let quibble: typeof Quibble;

    let appli: Appli;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());

      if (isNode || isElectronMain) {
        quibble = await import("quibble");

        const envPathsTest = (name: string) => ({ data: join(dossier, name) });
        await quibble.default.esm("env-paths", {}, envPathsTest);
      }
    });

    afterEach(async () => {
      if (appli) await appli.fermer();
      if (effacer) effacer();
      quibble?.default.reset();
    });

    it("valeur par défaut", async () => {
      appli = new Appli({ options: { dossier } });
      await appli.démarrer();

      const val = await appli.dossier();
      expect(val).to.be.a("string");

      if (isElectronMain || isNode) expect(fs.existsSync(val));
    });

    it("création dossier si non existant", async () => {
      const dossierAppli = join(dossier, "sous", "dossier");
      appli = new Appli({ options: { dossier: dossierAppli } });
      await appli.démarrer();

      const val = await appli.dossier();
      expect(val).to.equal(dossierAppli);

      if (isElectronMain || isNode) expect(fs.existsSync(val));
    });

    it("utilisation nom appli", async () => {
      appli = new Appli({ options: { nomAppli: "Mon appli" } });
      await appli.démarrer();

      const val = await appli.dossier();
      expect(val).to.be.a("string");
      if (isElectronMain || isNode)
        expect(val).to.equal(join(dossier, "Mon appli", "Mon appli"));
      else expect(val).to.equal(`./Mon appli`);
    });

    it("mode développement", async () => {
      appli = new Appli({
        options: { nomAppli: "Mon appli", mode: "dév" },
      });
      await appli.démarrer();

      const val = await appli.dossier();
      expect(val).to.be.a("string");
      if (isElectronMain || isNode)
        expect(val).to.equal(join(dossier, "Mon appli", "Mon appli-dév"));
      else expect(val).to.equal(`./Mon appli`);
    });
  });
});
