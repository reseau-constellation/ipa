import { writeFileSync } from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { créerOrbitesTest } from "@constl/utils-tests";
import { isLibp2p } from "libp2p";
import {
  isBrowser,
  isElectronMain,
  isElectronRenderer,
  isNode,
} from "wherearewe";
import { ServiceDonnéesAppli } from "@/v2/nébuleuse/services/services.js";
import { extraireHéliaEtLibp2p } from "@/v2/nébuleuse/nébuleuse.js";
import {
  FICHIER_VERROU,
  INTERVALE_VERROU,
} from "@/v2/nébuleuse/services/dossier.js";
import { ServiceAppli } from "@/v2/nébuleuse/appli/index.js";
import { dossierTempoPropre, utiliserFauxChronomètres } from "../utils.js";
import { NébuleuseTest } from "./utils.js";
import type sinon from "sinon";
import type { ServicesNécessairesDonnées } from "@/v2/nébuleuse/services/services.js";
import type {
  OptionsAppli,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";
import type { ServicesLibp2pNébuleuse } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import type { OrbitDB } from "@orbitdb/core";
import type { Helia } from "helia";
import type { Libp2p } from "libp2p";
import type { JSONSchemaType } from "ajv";
import type { PartielRécursif } from "@/v2/types.js";

describe("Nébuleuse", function () {
  describe("options - extraire libp2p et Hélia", function () {
    let orbite: OrbitDB<ServicesLibp2pNébuleuse>;
    let hélia: Helia<Libp2p<ServicesLibp2pNébuleuse>>;
    let libp2p: Libp2p<ServicesLibp2pNébuleuse>;
    let fermer: () => Promise<void>;

    before(async () => {
      const test = await créerOrbitesTest({ n: 1 });
      ({ fermer } = test);

      orbite = test.orbites[0];
      hélia = orbite.ipfs;
      libp2p = hélia.libp2p;
    });

    after(async () => await fermer());

    it("extraire Hélia - Orbite", () => {
      const { hélia: héliaExtraite } = extraireHéliaEtLibp2p({
        orbite: { orbite },
      });
      expect(héliaExtraite).to.equal(hélia);
    });

    it("extraire Hélia - Hélia", () => {
      const { hélia: héliaExtraite } = extraireHéliaEtLibp2p({
        hélia: { hélia },
      });
      expect(héliaExtraite).to.equal(hélia);
    });

    it("extraire Hélia - absente", () => {
      const { hélia: héliaExtraite } = extraireHéliaEtLibp2p({});
      expect(héliaExtraite).to.be.undefined();
    });

    it("extraire Libp2p - Orbite", () => {
      const { libp2p: libp2pExtrait } = extraireHéliaEtLibp2p({
        orbite: { orbite },
      });
      expect(isLibp2p(libp2pExtrait)).to.be.true();
    });

    it("extraire Libp2p - Hélia", () => {
      const { libp2p: libp2pExtrait } = extraireHéliaEtLibp2p({
        hélia: { hélia },
      });
      expect(isLibp2p(libp2pExtrait)).to.be.true();
    });

    it("extraire Libp2p - Libp2p", () => {
      const { libp2p: libp2pExtrait } = extraireHéliaEtLibp2p({
        libp2p: { libp2p },
      });
      expect(isLibp2p(libp2pExtrait)).to.be.true();
    });

    it("extraire Libp2p - absent", () => {
      const { libp2p: libp2pExtrait } = extraireHéliaEtLibp2p({});
      expect(libp2pExtrait).to.be.undefined();
    });
  });

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
      nébuleuse = new NébuleuseTest({
        options: { services: { dossier: { dossier } } },
        services: {},
      });

      await nébuleuse.démarrer();
      expect(Object.values(nébuleuse.services).every((s) => s.estDémarré));
    });

    it("fermeture", async () => {
      await nébuleuse.fermer();
      expect(Object.values(nébuleuse.services).every((s) => !s.estDémarré));
    });
  });

  describe("services additionnels", function () {
    class ServiceGénérique extends ServiceAppli {
      constructor({
        services,
        options,
      }: {
        services: ServicesAppli;
        options: OptionsAppli;
      }) {
        super({
          clef: "test générique",
          services,
          options,
        });
      }
    }

    const schémaTest1: JSONSchemaType<PartielRécursif<{ a: number }>> & {
      nullable: true;
    } = {
      type: "object",
      properties: { a: { type: "number", nullable: true } },
      nullable: true,
    };

    class ServiceTest1 extends ServiceDonnéesAppli<"test1", { a: number }> {
      constructor({
        services,
        options,
      }: {
        services: ServicesNécessairesDonnées<{ test1: { a: number } }>;
        options: OptionsAppli;
      }) {
        super({
          clef: "test1",
          services,
          options,
        });
      }
    }

    const schémaTest2: JSONSchemaType<PartielRécursif<{ b: number }>> & {
      nullable: true;
    } = {
      type: "object",
      properties: { b: { type: "number", nullable: true } },
      nullable: true,
    };

    class ServiceTest2 extends ServiceDonnéesAppli<"test2", { b: number }> {
      constructor({
        services,
        options,
      }: {
        services: ServicesNécessairesDonnées<{ test2: { b: number } }>;
        options: OptionsAppli;
      }) {
        super({
          clef: "test2",
          services,
          options,
        });
      }
    }

    type StructureDonnées = {
      test1: { a: number };
      test2: { b: number };
    };

    const schéma: JSONSchemaType<PartielRécursif<StructureDonnées>> = {
      type: "object",
      properties: {
        test1: schémaTest1,
        test2: schémaTest2,
      },
    };

    let nébuleuse: NébuleuseTest<StructureDonnées>;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());

      nébuleuse = new NébuleuseTest<StructureDonnées>({
        services: {
          générique: ({ options, services }) =>
            new ServiceGénérique({ options, services }),
          test1: ({ options, services }) =>
            new ServiceTest1({ options, services }),
          test2: ({ options, services }) =>
            new ServiceTest2({ options, services }),
        },
        options: {
          services: {
            dossier: { dossier },
            compte: { schéma },
          },
        },
      });
      await nébuleuse.démarrer();
    });

    after(async () => {
      await nébuleuse?.fermer();
      effacer?.();
    });

    it("accès aux services additionnels", async () => {
      const serviceTest1 = nébuleuse.services.test1;

      expect(serviceTest1).to.exist();
    });
  });

  describe("concurrence ouverture", function () {
    let horloge: sinon.SinonFakeTimers;

    let nébuleuse: NébuleuseTest;
    let nébuleuse2: NébuleuseTest | undefined;

    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      horloge = utiliserFauxChronomètres();
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    afterEach(async () => {
      horloge.restore();

      if (nébuleuse) await nébuleuse.fermer();
      if (nébuleuse2)
        try {
          await nébuleuse2.fermer();
        } catch (e) {
          if (!e.toString().includes("Erreur de démarrage")) throw e;
        } finally {
          nébuleuse2 = undefined;
        }

      if (effacer) effacer();
    });

    it("erreur pour la deuxième instance", async () => {
      nébuleuse = new NébuleuseTest({
        services: {},
        options: { services: { dossier: { dossier } } },
      });
      await nébuleuse.démarrer();

      nébuleuse2 = new NébuleuseTest({
        services: {},
        options: { services: { dossier: { dossier } } },
      });

      const démarrer = nébuleuse2.démarrer();
      await horloge.tickAsync(INTERVALE_VERROU * 1.5);
      await expect(démarrer).to.be.rejectedWith(
        `Le compte sur ${dossier} est déjà ouvert`,
      );
    });

    it("message verrou", async () => {
      nébuleuse = new NébuleuseTest({
        services: {},
        options: { services: { dossier: { dossier } } },
      });
      await nébuleuse.démarrer();

      const message = "Un message du processus initial.";
      await nébuleuse.services["dossier"].spécifierMessageVerrou({ message });

      nébuleuse2 = new NébuleuseTest({
        services: {},
        options: { services: { dossier: { dossier } } },
      });

      const démarrer = nébuleuse2.démarrer();
      await horloge.tickAsync(INTERVALE_VERROU * 1.5);
      await expect(démarrer).to.be.rejectedWith(message);
    });

    it("réouverture après fermeture", async () => {
      nébuleuse = new NébuleuseTest({
        services: {},
        options: { services: { dossier: { dossier } } },
      });
      await nébuleuse.démarrer();

      const idCompte = await nébuleuse.compte.obtIdCompte();
      await nébuleuse.fermer();

      nébuleuse = new NébuleuseTest({
        services: {},
        options: { services: { dossier: { dossier } } },
      });
      await nébuleuse.démarrer();

      expect(await nébuleuse.compte.obtIdCompte()).to.equal(idCompte);
    });

    it("fichier verrou résiduel", async () => {
      // On simule un fichier verrou qui n'aurait pas été bien effacé à la fermeture
      if (isElectronMain || isNode) {
        writeFileSync(join(dossier, FICHIER_VERROU), "");
      } else {
        localStorage.setItem(
          join(dossier, FICHIER_VERROU),
          JSON.stringify({ message: "", temps: Date.now() }),
        );
      }

      // On peut démarrer malgré tout
      nébuleuse = new NébuleuseTest({
        services: {},
        options: { services: { dossier: { dossier } } },
      });
      const démarrer = nébuleuse.démarrer();
      await horloge.tickAsync(INTERVALE_VERROU * 1.5);
      await démarrer;

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
        options: { services: { dossier: { dossier } } },
      });
    });

    after(async () => {
      await nébuleuse?.fermer();
      effacer?.();
    });

    it("fermeture immédiatement après ouverture", async function () {
      // if (!isNode || process.platform === "win32") this.skip(); // Pour l'instant
      await nébuleuse.démarrer();
      await nébuleuse.fermer();
    });
  });

  describe("effacer", function () {
    let idCompte: string;

    let nébuleuse: NébuleuseTest;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      nébuleuse = new NébuleuseTest({
        services: {},
        options: { services: { dossier: { dossier } } },
      });
      await nébuleuse.démarrer();
      idCompte = await nébuleuse.services["compte"].obtIdCompte();
    });

    after(async () => {
      await nébuleuse?.fermer();
      effacer?.();
    });

    it("données compte bien effacées", async function () {
      // Pour l'instant, la réinitialiation des `Datastore` et `Blockstore` empêchent le redémarrage du compte
      // sur le navigateur.
      if (isBrowser || isElectronRenderer) this.skip();

      await nébuleuse.effacer();

      // On rouvre une nouvelle nébuleuse avec le même dossier
      nébuleuse = new NébuleuseTest({
        services: {},
        options: { services: { dossier: { dossier } } },
      });
      await nébuleuse.démarrer();
      const nouvelIdCompte = await nébuleuse.services["compte"].obtIdCompte();

      // Rien de l'ancien compte ne devrait rester
      expect(nouvelIdCompte).to.not.equal(idCompte);
    });
  });
});
