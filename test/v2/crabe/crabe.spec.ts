import { writeFileSync } from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { ServiceDonnéesNébuleuse } from "@/v2/crabe/services/services.js";
import { FICHIER_VERROU } from "@/v2/crabe/crabe.js";
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
    let crabe: CrabeTest;
    let crabe2: CrabeTest | undefined;

    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    afterEach(async () => {
      if (crabe) await crabe.fermer();
      if (crabe2) await crabe2.fermer();
      crabe2 = undefined;

      if (effacer) effacer();
    });

    it("erreur pour la deuxième instance", async () => {
      crabe = new CrabeTest({ services: {}, options: { dossier } });
      await crabe.démarrer();

      crabe2 = new CrabeTest({ services: {}, options: { dossier } });
      await expect(crabe2.démarrer()).to.be.rejectedWith(
        `Le compte sur ${dossier} est déjà ouvert`,
      );
    });

    it("message verrou", async () => {
      {
        crabe = new CrabeTest({ services: {}, options: { dossier } });
        await crabe.démarrer();

        const message = "Un message du processus initial.";
        await crabe.spécifierMessageVerrou({ message });

        crabe2 = new CrabeTest({ services: {}, options: { dossier } });
        await expect(crabe2.démarrer()).to.be.rejectedWith(message);
      }
    });

    it("réouverture après fermeture", async () => {
      crabe = new CrabeTest({ services: {}, options: { dossier } });
      await crabe.démarrer();

      const idCompte = await crabe.compte.obtIdCompte();
      await crabe.fermer();

      crabe = new CrabeTest({ services: {}, options: { dossier } });
      await crabe.démarrer();

      expect(await crabe.compte.obtIdCompte()).to.equal(idCompte);
    });

    it("fichier verrou résiduel", async () => {
      // On simule un fichier verrou qui n'aurait pas été bien effacé à la fermeture
      writeFileSync(join(dossier, FICHIER_VERROU), "");

      // On peut démarrer malgré tout
      crabe = new CrabeTest({ services: {}, options: { dossier } });
      await crabe.démarrer();

      const idCompte = await crabe.compte.obtIdCompte();
      expect(crabe.compte.idCompteValide(idCompte)).to.be.true();
    });
  });

  describe("fermeture", function () {
    let crabe: CrabeTest;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      crabe = new CrabeTest({
        services: {},
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
  });
});
