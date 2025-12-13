import { writeFileSync } from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { ServiceDonnéesAppli } from "@/v2/nébuleuse/services/services.js";
import { FICHIER_VERROU } from "@/v2/nébuleuse/nébuleuse.js";
import { dossierTempoPropre } from "../utils.js";
import { NébuleuseTest } from "./utils.js";
import type { ServicesLibp2pTest } from "@constl/utils-tests";
import type { ServicesNécessairesCompte } from "@/v2/nébuleuse/services/compte/compte.js";
import type { Appli } from "@/v2/appli/appli.js";

describe.only("Nébuleuse", function () {
  describe("création", function () {
    let nébuleuse: NébuleuseTest;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    after(async () => {
      if (nébuleuse) await nébuleuse.fermer();
      effacer?.();
    });

    it("démarrage", async () => {
      nébuleuse = new NébuleuseTest({ options: { dossier }, services: {} });

      await nébuleuse.démarrer();
      expect(Object.values(nébuleuse.services).every((s) => s.estDémarré));
    });

    it("fermeture", async () => {
      await nébuleuse.fermer();
      expect(Object.values(nébuleuse.services).every((s) => !s.estDémarré));
    });
  });

  describe("services additionnels", function () {
    class ServiceTest1 extends ServiceDonnéesAppli<
      "test1",
      { a: number },
      ServicesLibp2pTest
    > {
      constructor({
        appli,
      }: {
        appli: Appli<ServicesNécessairesCompte<ServicesLibp2pTest>>;
      }) {
        super({
          clef: "test1",
          appli,
          options: {
            schéma: {
              type: "object",
              properties: { a: { type: "number", nullable: true } },
            },
          },
        });
      }
    }

    class ServiceTest2 extends ServiceDonnéesAppli<
      "test2",
      { b: number },
      ServicesLibp2pTest
    > {
      constructor({
        appli,
      }: {
        appli: Appli<ServicesNécessairesCompte<ServicesLibp2pTest>>;
      }) {
        super({
          clef: "test2",
          appli,
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

    let nébuleuse: NébuleuseTest<StructureDonnées>;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());

      nébuleuse = new NébuleuseTest<StructureDonnées>({
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
      await nébuleuse.démarrer();
    });

    after(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("accès aux services additionnels", async () => {
      const serviceTest1 = nébuleuse.services.test1;

      expect(serviceTest1).to.exist();
    });

    it("erreur pour mauvaise clef", async () => {
      const bd = await nébuleuse.services.compte.bd();

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
    let nébuleuse: NébuleuseTest;
    let nébuleuse2: NébuleuseTest | undefined;

    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    afterEach(async () => {
      if (nébuleuse) await nébuleuse.fermer();
      if (nébuleuse2) await nébuleuse2.fermer();
      nébuleuse2 = undefined;

      if (effacer) effacer();
    });

    it("erreur pour la deuxième instance", async () => {
      nébuleuse = new NébuleuseTest({ services: {}, options: { dossier } });
      await nébuleuse.démarrer();

      nébuleuse2 = new NébuleuseTest({ services: {}, options: { dossier } });
      await expect(nébuleuse2.démarrer()).to.be.rejectedWith(
        `Le compte sur ${dossier} est déjà ouvert`,
      );
    });

    it("message verrou", async () => {
      {
        nébuleuse = new NébuleuseTest({ services: {}, options: { dossier } });
        await nébuleuse.démarrer();

        const message = "Un message du processus initial.";
        await nébuleuse.spécifierMessageVerrou({ message });

        nébuleuse2 = new NébuleuseTest({ services: {}, options: { dossier } });
        await expect(nébuleuse2.démarrer()).to.be.rejectedWith(message);
      }
    });

    it("réouverture après fermeture", async () => {
      nébuleuse = new NébuleuseTest({ services: {}, options: { dossier } });
      await nébuleuse.démarrer();

      const idCompte = await nébuleuse.compte.obtIdCompte();
      await nébuleuse.fermer();

      nébuleuse = new NébuleuseTest({ services: {}, options: { dossier } });
      await nébuleuse.démarrer();

      expect(await nébuleuse.compte.obtIdCompte()).to.equal(idCompte);
    });

    it("fichier verrou résiduel", async () => {
      // On simule un fichier verrou qui n'aurait pas été bien effacé à la fermeture
      writeFileSync(join(dossier, FICHIER_VERROU), "");

      // On peut démarrer malgré tout
      nébuleuse = new NébuleuseTest({ services: {}, options: { dossier } });
      await nébuleuse.démarrer();

      const idCompte = await nébuleuse.compte.obtIdCompte();
      expect(nébuleuse.compte.idCompteValide(idCompte)).to.be.true();
    });
  });

  describe("fermeture", function () {
    let nébuleuse: NébuleuseTest;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      nébuleuse = new NébuleuseTest({
        services: {},
        options: {
          dossier,
        },
      });
    });

    after(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("fermeture immédiatement après ouverture", async function () {
      // if (!isNode || process.platform === "win32") this.skip(); // Pour l'instant
      await nébuleuse.démarrer();
      await nébuleuse.fermer();
    });
  });
});
