import {
  OptionsDéfautLibp2pNavigateur,
  OptionsDéfautLibp2pNode,
} from "@constl/utils-tests";

import { expect } from "aegir/chai";
import { createHelia } from "helia";
import { createLibp2p } from "libp2p";
import { isBrowser } from "wherearewe";
import { CID } from "multiformats";
import toBuffer from "it-to-buffer";
import { ServiceLibp2p } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import {
  ServiceHélia,
} from "@/v2/nébuleuse/services/hélia.js";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";
import { ServiceStockage } from "@/v2/nébuleuse/index.js";
import { ServiceDossier } from "@/v2/nébuleuse/services/dossier.js";
import { dossierTempoPropre } from "../../utils.js";
import { ServiceLibp2pTest } from "./utils.js";
import type { ServicesNécessairesHélia } from "@/v2/nébuleuse/services/hélia.js";
import type { ServicesLibp2pNébuleuse } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import type { Libp2p } from "libp2p";
import type { Helia } from "helia";
import type { ServicesLibp2pTest } from "@constl/utils-tests";

describe.only("Service Hélia", function () {
  describe("demarrage", function () {
    let appli: Appli<ServicesNécessairesHélia & { hélia: ServiceHélia }>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    afterEach(async () => {
      await appli?.fermer();
      effacer();
    });

    it("hélia démarre", async () => {
      appli = new Appli<ServicesNécessairesHélia & { hélia: ServiceHélia }>({
        services: {
          dossier: ServiceDossier,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
        },
        options: {
          services: {dossier: {dossier}},
        },
      });
      await appli.démarrer();

      const serviceHélia = appli.services["hélia"];
      const hélia = await serviceHélia.hélia();

      expect(hélia).to.exist();
    });
  });

  describe("fermer", function () {
    let appli: Appli<{
      libp2p: ServiceLibp2pTest;
      hélia: ServiceHélia;
      stockage: ServiceStockage;
    }>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    afterEach(async () => {
      if (appli?.estDémarrée) await appli?.fermer();
      effacer();
    });

    it("hélia fermé si endogène", async () => {
      appli = new Appli<
        ServicesNécessairesHélia<ServicesLibp2pTest> & {
          hélia: ServiceHélia<ServicesLibp2pTest>;
        }
      >({
        services: {
          dossier: ServiceDossier,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
        },
        options: {
          services: { dossier: { dossier } },
        },
      });
      await appli.démarrer();

      const serviceHélia = appli.services["hélia"];
      const hélia = await serviceHélia.hélia();
      await appli.fermer();

      expect(hélia.libp2p.status).to.equal("stopped");
    });

    it("hélia non fermé si exogène", async () => {
      const libp2p = await createLibp2p(
        isBrowser ? OptionsDéfautLibp2pNavigateur() : OptionsDéfautLibp2pNode(),
      );
      const héliaOriginal = await createHelia({ libp2p });

      appli = new Appli<ServicesNécessairesHélia & { hélia: ServiceHélia }>({
        services: {
          dossier: ServiceDossier,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2p,
          hélia: ServiceHélia,
        },
        options: {
          services: {
            dossier: { dossier },
            hélia: {
              hélia: héliaOriginal as Helia<Libp2p<ServicesLibp2pNébuleuse>>,
            },
          },
        },
      });
      await appli.démarrer();

      const serviceHélia = appli.services["hélia"];
      const hélia = await serviceHélia.hélia();
      await appli.fermer();

      expect(hélia.libp2p.status).to.equal("started");
      await hélia.stop();
    });
  });

  describe("fonctionnalités", function () {
    let appli: Appli<ServicesNécessairesHélia & { hélia: ServiceHélia }>;
    let serviceHélia: ServiceHélia;

    let idc: string;

    let dossier: string;
    let effacer: () => void;

    const texte = "வணக்கம்";
    const contenu = new TextEncoder().encode(texte);

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      appli = new Appli<
        ServicesNécessairesHélia<ServicesLibp2pTest> & {
          hélia: ServiceHélia<ServicesLibp2pTest>;
        }
      >({
        services: {
          dossier: ServiceDossier,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
        },
        options: {
          services: { dossier: { dossier } },
        },
      });
      await appli.démarrer();

      serviceHélia = appli.services["hélia"];
    });

    after(async () => {
      await appli?.fermer();
      effacer();
    });

    it("ajouter fichier à SFIP", async () => {
      idc = await serviceHélia.ajouterFichierÀSFIP({
        contenu,
        nomFichier: "un fichier.txt",
      });
      expect(typeof idc).to.equal("string");

      const [idcRacine, nomFichier] = idc.split("/");
      CID.parse(idcRacine);
      expect(nomFichier).to.equal("un fichier.txt");
    });

    it("obtenir fichier de SFIP", async () => {
      const obtenu = await serviceHélia.obtFichierDeSFIP({ id: idc });
      expect(new TextDecoder().decode(obtenu!)).to.equal(texte);
    });

    it("obtenir flux itérable de SFIP", async () => {
      const flux = await serviceHélia.obtItérableAsyncSFIP({ id: idc });
      const obtenu = await toBuffer(flux);
      expect(new TextDecoder().decode(obtenu!)).to.equal(texte);
    });
  });
});
