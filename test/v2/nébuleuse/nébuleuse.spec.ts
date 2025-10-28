import fs from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { isElectronMain, isNode } from "wherearewe";
import { createSandbox } from "sinon";
import { dossierTempo } from "@constl/utils-tests";
import {
  Nébuleuse,
  OptionsNébuleuse,
  ServiceNébuleuse,
  ServicesNébuleuse,
} from "@/v2/nébuleuse/nébuleuse.js";

const boîteÀSable = createSandbox();

describe.only("Nébuleuse", function () {
  describe("Démarrage", function () {
    it("Démarrer sans services", async () => {
      const nébuleuse = new Nébuleuse();
      await nébuleuse.démarrer();
      expect(nébuleuse.estDémarrée).to.be.true();
    });

    it("Services démarrés en ordre", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
        c: ServiceC;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "b",
            nébuleuse,
            dépendances: ["a"],
          });
        }
      }
      class ServiceC extends ServiceNébuleuse<"c", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "c",
            nébuleuse,
            dépendances: ["a", "b"],
          });
        }
      }
      const nébuleuse = new Nébuleuse<ServicesTest>({
        services: {
          a: ServiceA,
          b: ServiceB,
          c: ServiceC,
        },
      });
      await nébuleuse.démarrer();
      expect(nébuleuse.estDémarrée).to.be.true();
    });

    it("Services bien démarrés lorsque Nébuleuse est démarrée", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }
      }
      const nébuleuse = new Nébuleuse<ServicesTest>({
        services: {
          a: ServiceA,
        },
      });
      nébuleuse.démarrer();
      await nébuleuse.démarrée();

      expect(
        Object.values(nébuleuse.services).every((s) => s.estDémarré),
      ).to.be.true();
    });

    it("Erreur lorsque dépendances circulaires", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
            dépendances: ["b"],
          });
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "b",
            nébuleuse,
            dépendances: ["a"],
          });
        }
      }
      const nébuleuse = new Nébuleuse({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
      });

      await expect(nébuleuse.démarrer()).to.eventually.be.rejectedWith(
        "circulaire",
      );
    });
  });

  describe("Fermer", function () {
    it("Fermer sans services", async () => {
      const nébuleuse = new Nébuleuse();
      await nébuleuse.démarrer();
      await nébuleuse.fermer();
      expect(nébuleuse.estDémarrée).to.be.false();
    });

    it("Services fermés en ordre", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
        c: ServiceC;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }
        async fermer(): Promise<void> {
          // Accéder services b et c qui ne sont pas dans les dépendances de a
          expect(this.nébuleuse.services["b"].estDémarré).to.be.false();
          expect(this.nébuleuse.services["c"].estDémarré).to.be.false();
          return await super.fermer();
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "b",
            nébuleuse,
            dépendances: ["a"],
          });
        }
        async fermer(): Promise<void> {
          expect(this.service("a").estDémarré).to.be.true();

          // Accéder services["c"] qui n'est pas dans les dépendances de b
          expect(this.nébuleuse.services["c"].estDémarré).to.be.false();
          return await super.fermer();
        }
      }
      class ServiceC extends ServiceNébuleuse<"c", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "c",
            nébuleuse,
            dépendances: ["a", "b"],
          });
        }

        async fermer(): Promise<void> {
          expect(this.service("a").estDémarré).to.be.true();
          expect(this.service("b").estDémarré).to.be.true();
          return await super.fermer();
        }
      }
      const nébuleuse = new Nébuleuse({
        services: {
          a: ServiceA,
          b: ServiceB,
          c: ServiceC,
        },
      });
      await nébuleuse.démarrer();
      await nébuleuse.fermer();
    });

    it("Services bien fermés lorsque Nébuleuse est fermée", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }
      }
      const nébuleuse = new Nébuleuse<ServicesTest>({
        services: {
          a: ServiceA,
        },
      });
      await nébuleuse.démarrer();
      await nébuleuse.fermer();

      expect(
        Object.values(nébuleuse.services).every((s) => !s.estDémarré),
      ).to.be.true();
    });

    it("Attendre démarré avant de fermer", async () => {
      let nébuleuseFutDémareée = false;

      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }

        async démarrer() {
          // Un tout petit délai
          await new Promise((résoudre) => setTimeout(résoudre, 25));
          return await super.démarrer();
        }

        async fermer(): Promise<void> {
          expect(this.estDémarré).to.be.true();
          expect(nébuleuseFutDémareée).to.be.true();
          return await super.fermer();
        }
      }

      class NébuleuseTest extends Nébuleuse<ServicesTest> {
        async démarrer(): Promise<void> {
          const retour = await super.démarrer();
          nébuleuseFutDémareée = true;
          return retour;
        }

        async fermer(): Promise<void> {
          return await super.fermer();
        }
      }
      const nébuleuse = new NébuleuseTest({
        services: {
          a: ServiceA,
        },
      });
      nébuleuse.démarrer(); // On n'attend pas avant de fermer
      await nébuleuse.fermer();
    });

    it("erreur lorsque dépendances circulaires", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
            dépendances: ["b"],
          });
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "b",
            nébuleuse,
            dépendances: [],
          });
        }
      }
      const nébuleuse = new Nébuleuse({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
      });
      await nébuleuse.démarrer();

      // Créer dépendance circulaire
      nébuleuse.services["b"].dépendances = ["a"];

      await expect(nébuleuse.fermer()).to.eventually.be.rejectedWith(
        "circulaire",
      );
    });

    it("fermer lorsque déjà fermée", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }
      }
      const nébuleuse = new Nébuleuse<ServicesTest>({
        services: {
          a: ServiceA,
        },
      });
      await nébuleuse.démarrer();
      await nébuleuse.fermer();

      // Fermer à nouveau
      await nébuleuse.fermer();

      expect(
        Object.values(nébuleuse.services).every((s) => !s.estDémarré),
      ).to.be.true();
      expect(nébuleuse.estDémarrée).to.be.false();
    });

    it("erreur de fermeture service", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }
        fermer(): Promise<void> {
          throw new Error("erreur de fermeture");
        }
      }
      const nébuleuse = new Nébuleuse<ServicesTest>({
        services: {
          a: ServiceA,
        },
      });
      await nébuleuse.démarrer();
      
      await expect(nébuleuse.fermer()).to.eventually.be.rejectedWith("erreur de fermeture");

    });

    it("fermeture après erreur de démarrage service", async () => {
      type ServicesTest = {
        a: ServiceA;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }
        démarrer(): Promise<void> {
          throw new Error("erreur de démarrage");
        }
      }
      const nébuleuse = new Nébuleuse<ServicesTest>({
        services: {
          a: ServiceA,
        },
      });
      try {
        await nébuleuse.démarrer();
      } catch {
        await expect(nébuleuse.fermer()).to.eventually.be.rejectedWith("Erreur de démarrage");
      }

    });
  });

  describe("Communication entre services", function () {
    it("Accès dépendance", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }
        fonction() {
          return 3;
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "b",
            nébuleuse,
            dépendances: ["a"],
          });
        }
        async démarrer() {
          expect(this.service("a").fonction()).to.equal(3);
          return super.démarrer();
        }
      }
      const nébuleuse = new Nébuleuse({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
      });
      await nébuleuse.démarrer();
    });

    it("Accès retour initialisation", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest, string> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }
        async démarrer() {
          this.estDémarré = "une valeur spéciale";
          return await super.démarrer();
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "b",
            nébuleuse,
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

      const nébuleuse = new Nébuleuse({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
      });
      await nébuleuse.démarrer();
    });

    it("erreur si dépendance non spécifiée", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "a",
            nébuleuse,
          });
        }
        fonction() {
          return 3;
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            clef: "b",
            nébuleuse,
          });
        }

        async démarrer() {
          return super.démarrer();
        }

        async accéderA() {
          return this.service("a").fonction();
        }
      }
      const nébuleuse = new Nébuleuse({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
      });
      await nébuleuse.démarrer();

      expect(nébuleuse.services["b"].accéderA()).to.be.rejectedWith(
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

      class ServiceA extends ServiceNébuleuse<
        "a",
        ServicesNébuleuse,
        unknown,
        OptionsServiceA
      > {
        constructor({
          nébuleuse,
          options,
        }: {
          nébuleuse: Nébuleuse<{ a: ServiceA }>;
          options?: OptionsServiceA;
        }) {
          super({
            clef: "a",
            nébuleuse,
            options,
          });
        }

        async démarrer() {
          expect(this.options.a).to.equal(8);
          return super.démarrer();
        }
      }

      class ServiceB extends ServiceNébuleuse<
        "b",
        ServicesTest,
        unknown,
        OptionsServiceB
      > {
        constructor({
          nébuleuse,
          options,
        }: {
          nébuleuse: Nébuleuse<ServicesTest>;
          options?: OptionsServiceB;
        }) {
          super({
            clef: "b",
            nébuleuse,
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
      const nébuleuse = new Nébuleuse<ServicesTest>({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
        options,
      });

      await nébuleuse.démarrer();
    });

    it("Service A dépendant de service B", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      type OptionsServiceA = { a?: number };
      type OptionsServiceB = { b?: number };

      class ServiceA extends ServiceNébuleuse<
        "a",
        { a: ServiceA },
        unknown,
        OptionsServiceA
      > {
        constructor({
          nébuleuse,
          options,
        }: {
          nébuleuse: Nébuleuse<{ a: ServiceA }>;
          options?: OptionsServiceA;
        }) {
          super({
            clef: "a",
            nébuleuse,
            options,
          });
        }

        async démarrer() {
          expect(this.options.a).to.equal(8);
          return super.démarrer();
        }
      }

      class ServiceB extends ServiceNébuleuse<
        "b",
        ServicesTest,
        unknown,
        OptionsServiceB
      > {
        constructor({
          nébuleuse,
          options,
        }: {
          nébuleuse: Nébuleuse<ServicesTest>;
          options?: OptionsServiceB;
        }) {
          super({
            clef: "b",
            nébuleuse,
            dépendances: ["a"],
            options,
          });
        }
        async démarrer() {
          expect(this.options.b).to.equal(7);
          return super.démarrer();
        }
      }
      const options: OptionsNébuleuse<ServicesTest> = {
        services: {
          a: { a: 8 },
          b: { b: 7 },
        },
      };
      const nébuleuse = new Nébuleuse({
        services: {
          a: ServiceA,
          b: ServiceB,
        },
        options,
      });

      await nébuleuse.démarrer();
    });
  });

  describe("Dossier", function () {
    let nébuleuse: Nébuleuse;
    let dossier: string;
    let effacer: () => void;
    let envPathsTest: sinon.SinonStub;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempo());
      const quibble = await import("quibble");
      envPathsTest = boîteÀSable.stub().returns(join(dossier, "appli"));
      quibble("env-paths", {}, envPathsTest);
    });

    afterEach(async () => {
      if (nébuleuse) await nébuleuse.fermer();
      if (effacer) effacer();
      envPathsTest.restore();
    });

    it("valeur par défaut", async () => {
      nébuleuse = new Nébuleuse({ options: { dossier } });
      await nébuleuse.démarrer();

      const val = await nébuleuse.dossier();
      expect(val).to.be.a("string");

      if (isElectronMain || isNode) expect(fs.existsSync(val));
    });

    it("création dossier si non existant", async () => {
      const dossierNébuleuse = join(dossier, "sous", "dossier");
      nébuleuse = new Nébuleuse({ options: { dossier: dossierNébuleuse } });
      await nébuleuse.démarrer();

      const val = await nébuleuse.dossier();
      expect(val).to.equal(dossierNébuleuse);

      if (isElectronMain || isNode) expect(fs.existsSync(val));
    });

    it("utilisation nom appli", async () => {
      nébuleuse = new Nébuleuse({ options: { nomAppli: "Mon appli" } });
      await nébuleuse.démarrer();

      const val = await nébuleuse.dossier();
      expect(val).to.be.a("string");
      if (isElectronMain || isNode)
        expect(val).to.equal(join(dossier, "appli", "Mon appli"));
      else expect(val).to.equal(`./Mon appli`);
    });

    it("mode développement", async () => {
      nébuleuse = new Nébuleuse({
        options: { nomAppli: "Mon appli", mode: "dév" },
      });
      await nébuleuse.démarrer();

      const val = await nébuleuse.dossier();
      expect(val).to.be.a("string");
      if (isElectronMain || isNode)
        expect(val).to.equal(join(dossier, "appli", "Mon appli-dév"));
      else expect(val).to.equal(`./Mon appli`);
    });
  });
});
