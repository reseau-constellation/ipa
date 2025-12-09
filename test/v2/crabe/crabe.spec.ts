import { expect } from "aegir/chai";
import { ServiceDonnéesNébuleuse } from "@/v2/crabe/services/services.js";
import { dossierTempoPropre } from "../utils.js";
import { CrabeTest } from "./utils.js";
import type { ServicesLibp2pTest } from "@constl/utils-tests";
import type { ServicesNécessairesCompte } from "@/v2/crabe/services/compte/compte.js";
import type { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";

describe.only("Crabe", function () {
  describe("création", function () {
    let crabe: CrabeTest;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    after(async () => {
      if (crabe) await crabe.fermer();
      effacer?.();
    });

    it("démarrage", async () => {
      crabe = new CrabeTest({ options: { dossier }, services: {} });

      await crabe.démarrer();
      expect(Object.values(crabe.services).every((s) => s.estDémarré));
    });

    it("fermeture", async () => {
      await crabe.fermer();
      expect(Object.values(crabe.services).every((s) => !s.estDémarré));
    });
  });

  describe("services additionnels", function () {
    class ServiceTest1 extends ServiceDonnéesNébuleuse<
      "test1",
      { a: number },
      ServicesLibp2pTest
    > {
      constructor({
        nébuleuse,
      }: {
        nébuleuse: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>;
      }) {
        super({
          clef: "test1",
          nébuleuse,
          options: {
            schéma: {
              type: "object",
              properties: { a: { type: "number", nullable: true } },
            },
          },
        });
      }
    }

    class ServiceTest2 extends ServiceDonnéesNébuleuse<
      "test2",
      { b: number },
      ServicesLibp2pTest
    > {
      constructor({
        nébuleuse,
      }: {
        nébuleuse: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>;
      }) {
        super({
          clef: "test2",
          nébuleuse,
          options: {
            schéma: {
              type: "object",
              properties: { b: { type: "number", nullable: true } },
            },
          },
        });
      }
    }

    type StructureDonnées = {
      test1: { a: number };
      test2: { b: number };
    };

    let crabe: CrabeTest<StructureDonnées>;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());

      crabe = new CrabeTest<StructureDonnées>({
        services: {
          test1: ServiceTest1,
          test2: ServiceTest2,
        },
        options: {
          dossier,
          services: {
            test1: {
              schéma: {
                type: "object",
                properties: { a: { type: "number", nullable: true } },
              },
            },
          },
        },
      });
      await crabe.démarrer();
    });

    after(async () => {
      await crabe.fermer();
      effacer();
    });

    it("accès aux services additionnels", async () => {
      const serviceTest1 = crabe.services.test1;

      expect(serviceTest1).to.exist();
    });

    it("erreur pour mauvaise clef", async () => {
      const bd = await crabe.services.compte.bd();

      // @ts-expect-error  Clef inexistante dans la structure
      await expect(bd.set("n/existe/pas", 1)).to.eventually.be.rejectedWith(
        "Unsupported key n/existe/pas.",
      );

      await expect(
        // @ts-expect-error Service inexistant
        bd.set("service/inexistant", 1),
      ).to.eventually.be.rejectedWith("Unsupported key service/inexistant.");
    });
  });


  describe("concurrence ouverture", function () {

    describe("même dossier", async () => {
      let crabes: CrabeTest[];
      let fermer: Oublier;

      let crabe2: CrabeTest;

      let dossier: string;

      before(async () => {
        ({ crabes, fermer } = await créerCrabesTest({
          n: 1,
          services: {},
        }));
        dossier = await crabes[0].dossier()
      });

      after(async () => {
        if (fermer) await fermer();
      });

      it("erreur pour la deuxième instance", async () => {
        crabe2 = new CrabeTest({ services: {}, options: { dossier }, });
        await expect(crabe2.démarrer()).to.be.rejectedWith(
          `Déjà lancée sur le dossier ${dossier}`,
        );
      });

      it("fermeture en double", async () => {
        await expect(crabe2.fermer()).to.be.rejectedWith(
          `Déjà lancée sur le dossier ${dossier}`,
        );
      });
    });

    describe("réouverture après fermeture")
  })

  describe("fermeture", function () {
    let crabe: CrabeTest;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      crabe = new CrabeTest({
        services: { },
        options: {
          dossier,
        },
      });
    });

    after(async () => {
      await crabe.fermer();
      effacer();
    });

    it("fermeture immédiatement après ouverture", async function () {
      // if (!isNode || process.platform === "win32") this.skip(); // Pour l'instant
      await crabe.démarrer();
      await crabe.fermer();
    });
  })
});
