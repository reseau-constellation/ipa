import {
  OptionsDéfautLibp2pNavigateur,
  OptionsDéfautLibp2pNode,
  ServicesLibp2pTest,
  créerOrbitesTest,
  dossierTempo,
} from "@constl/utils-tests";

import { OrbitDB } from "@orbitdb/core";
import { expect } from "aegir/chai";
import { Helia, createHelia } from "helia";
import { Libp2p, createLibp2p } from "libp2p";
import { isBrowser } from "wherearewe";
import {
  ServiceLibp2p,
  ServicesLibp2pCrabe,
} from "@/v2/crabe/services/libp2p/libp2p.js";
import {
  ServiceHélia,
  ServicesNécessairesHélia,
  extraireHéliaDesOptions,
} from "@/v2/crabe/services/hélia.js";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { ServiceStockage } from "@/v2/crabe/index.js";
import { ServiceLibp2pTest } from "./utils.js";

describe.only("Service Hélia", function () {
  describe("options", function () {
    let orbite: OrbitDB<ServicesLibp2pTest>;
    let hélia: Helia<Libp2p<ServicesLibp2pTest>>;

    let fermer: () => Promise<void>;

    before(async () => {
      const test = await créerOrbitesTest({ n: 1 });
      ({ fermer } = test);

      orbite = test.orbites[0];
      hélia = orbite.ipfs;
    });

    after(async () => {
      await fermer();
    });

    it("extraire Hélia - Orbite", () => {
      const val = extraireHéliaDesOptions({
        services: {
          orbite: { orbite },
        },
      });
      expect(val).to.equal(hélia);
    });

    it("extraire Hélia - Hélia", () => {
      const val = extraireHéliaDesOptions({
        services: {
          hélia: { hélia },
        },
      });
      expect(val).to.equal(hélia);
    });

    it("extraire Hélia - absente", () => {
      const val = extraireHéliaDesOptions({});
      expect(val).to.be.undefined();
    });
  });

  describe("demarrage", function () {
    let nébuleuse: Nébuleuse<
      ServicesNécessairesHélia & { hélia: ServiceHélia }
    >;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempo());
    });

    afterEach(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("hélia démarre", async () => {
      nébuleuse = new Nébuleuse<
        ServicesNécessairesHélia & { hélia: ServiceHélia }
      >({
        services: {
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          stockage: ServiceStockage,
        },
        options: {
          dossier,
        },
      });
      await nébuleuse.démarrer();

      const serviceHélia = nébuleuse.services["hélia"];
      const hélia = await serviceHélia.hélia();

      expect(hélia).to.exist();
    });
  });

  describe("fermer", function () {
    let nébuleuse: Nébuleuse<{
      libp2p: ServiceLibp2pTest;
      hélia: ServiceHélia;
      stockage: ServiceStockage;
    }>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempo());
    });

    this.afterEach(async () => {
      if (nébuleuse.estDémarrée) await nébuleuse.fermer();
      effacer();
    });

    it("hélia fermé si endogène", async () => {
      nébuleuse = new Nébuleuse<ServicesNécessairesHélia<ServicesLibp2pTest>>({
        services: {
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          stockage: ServiceStockage,
        },
        options: {
          dossier,
        },
      });
      await nébuleuse.démarrer();

      const serviceHélia = nébuleuse.services["hélia"];
      const hélia = await serviceHélia.hélia();
      await nébuleuse.fermer();

      expect(hélia.libp2p.status).to.equal("stopped");
    });

    it("hélia non fermé si exogène", async () => {
      const libp2p = await createLibp2p(
        isBrowser ? OptionsDéfautLibp2pNavigateur() : OptionsDéfautLibp2pNode(),
      );
      const héliaOriginal = await createHelia({ libp2p });

      nébuleuse = new Nébuleuse<
        ServicesNécessairesHélia & { hélia: ServiceHélia }
      >({
        services: {
          libp2p: ServiceLibp2p,
          hélia: ServiceHélia,
          stockage: ServiceStockage,
        },
        options: {
          dossier,
          services: {
            hélia: {
              hélia: héliaOriginal as Helia<Libp2p<ServicesLibp2pCrabe>>,
            },
          },
        },
      });
      await nébuleuse.démarrer();

      const serviceHélia = nébuleuse.services["hélia"];
      const hélia = await serviceHélia.hélia();
      await nébuleuse.fermer();

      expect(hélia.libp2p.status).to.equal("started");
      await hélia.stop();
    });
  });
});
