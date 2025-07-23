import { expect } from "aegir/chai";
import { Nébuleuse, ServiceNébuleuse } from "@/nébuleuse.js";

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
            type: "a",
            nébuleuse,
          });
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            type: "b",
            nébuleuse,
            dépendances: ["a"],
          });
        }
      }
      class ServiceC extends ServiceNébuleuse<"c", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            type: "c",
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

    it("Erreur lorsque dépendances circulaires", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            type: "a",
            nébuleuse,
            dépendances: ["b"],
          });
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            type: "b",
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
            type: "a",
            nébuleuse,
          });
        }
        async fermer(): Promise<void> {
          expect(this.service("b").estDémarré).to.be.false();
          expect(this.service("c").estDémarré).to.be.false();
          return await super.fermer();
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            type: "b",
            nébuleuse,
            dépendances: ["a"],
          });
        }
        async fermer(): Promise<void> {
          expect(this.service("a").estDémarré).to.be.true();
          expect(this.service("c").estDémarré).to.be.false();
          return await super.fermer();
        }
      }
      class ServiceC extends ServiceNébuleuse<"c", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            type: "c",
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

    it("Erreur lorsque dépendances circulaires", async () => {
      type ServicesTest = {
        a: ServiceA;
        b: ServiceB;
      };
      class ServiceA extends ServiceNébuleuse<"a", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            type: "a",
            nébuleuse,
            dépendances: ["b"],
          });
        }
      }
      class ServiceB extends ServiceNébuleuse<"b", ServicesTest> {
        constructor({ nébuleuse }: { nébuleuse: Nébuleuse<ServicesTest> }) {
          super({
            type: "b",
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
            type: "a",
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
            type: "b",
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
            type: "a",
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
            type: "b",
            nébuleuse,
            dépendances: ["a"],
          });
        }
        async démarrer() {
          expect(await this.service("a").démarré()).to.equal("une valeur spéciale");
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
  });
});
