import { dossierTempoPropre, optionsDéfautLibp2p } from "@constl/utils-tests";

import { expect } from "aegir/chai";

import { CID } from "multiformats";
import toBuffer from "it-to-buffer";
import { type HeliaWithLibp2p } from "@helia/libp2p";
import { serviceHélia } from "../../../src/nébuleuse/services/hélia.ts";
import { Appli } from "../../../src/nébuleuse/appli/appli.ts";
import { serviceDossier } from "../../../src/nébuleuse/services/dossier.ts";
import { serviceStockage } from "../../../src/nébuleuse/services/stockage.ts";
import { créerHéliaÉphémère } from "../../utils.ts";
import { serviceHéliaTest } from "./utils.ts";
import type { ServiceHéliaTest } from "./utils.ts";
import type { ServiceStockage } from "../../../src/nébuleuse/index.ts";
import type {
  ServicesNécessairesHélia,
  ServiceHélia,
} from "../../../src/nébuleuse/services/hélia.ts";
import type { ServicesLibp2pNébuleuse } from "../../../src/nébuleuse/services/libp2p/libp2p.ts";

describe("Service Hélia", function () {
  describe("demarrage", function () {
    let appli: Appli<ServicesNécessairesHélia & { hélia: ServiceHélia }>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    afterEach(async () => {
      await appli?.fermer();
      effacer?.();
    });

    it("hélia démarre", async () => {
      appli = new Appli<ServicesNécessairesHélia & { hélia: ServiceHélia }>({
        services: {
          dossier: serviceDossier({ dossier }),
          stockage: serviceStockage(),
          hélia: serviceHéliaTest(),
        },
      });
      await appli.démarrer();

      const hélia = await appli.services["hélia"].hélia();

      expect(hélia).to.exist();
    });
  });

  describe("fermer", function () {
    let appli: Appli<{
      hélia: ServiceHéliaTest;
      stockage: ServiceStockage;
    }>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    afterEach(async () => {
      if (appli?.estDémarrée) await appli?.fermer();
      effacer?.();
    });

    it("hélia fermé si endogène", async () => {
      appli = new Appli<
        ServicesNécessairesHélia & {
          hélia: ServiceHélia;
        }
      >({
        services: {
          dossier: serviceDossier({ dossier }),
          stockage: serviceStockage(),
          hélia: serviceHéliaTest(),
        },
      });
      await appli.démarrer();

      const hélia = await appli.services["hélia"].hélia();
      await appli.fermer();

      expect(hélia.libp2p.status).to.equal("stopped");
    });

    it("hélia non fermée si exogène", async () => {
      const libp2p = optionsDéfautLibp2p();
      const héliaOriginal = await créerHéliaÉphémère({ libp2p }).start();

      appli = new Appli<ServicesNécessairesHélia & { hélia: ServiceHélia }>({
        services: {
          dossier: serviceDossier({ dossier }),
          stockage: serviceStockage(),
          hélia: serviceHélia({
            hélia: héliaOriginal as HeliaWithLibp2p<ServicesLibp2pNébuleuse>,
          }),
        },
      });
      await appli.démarrer();

      const hélia = await appli.services["hélia"].hélia();
      await appli.fermer();

      expect(hélia.status).to.equal("started");
      expect(hélia.libp2p.status).to.equal("started");
      await hélia.stop();

      expect(hélia.status).to.equal("stopped");
      expect(hélia.libp2p.status).to.equal("stopped");
    });
  });

  describe("fonctionnalités", function () {
    let appli: Appli<ServicesNécessairesHélia & { hélia: ServiceHélia }>;

    let idc: string;

    let dossier: string;
    let effacer: () => void;

    const texte = "வணக்கம்";
    const contenu = new TextEncoder().encode(texte);

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      appli = new Appli<
        ServicesNécessairesHélia & {
          hélia: ServiceHélia;
        }
      >({
        services: {
          dossier: serviceDossier({ dossier }),
          stockage: serviceStockage(),
          hélia: serviceHéliaTest(),
        },
      });
      await appli.démarrer();
    });

    after(async () => {
      await appli?.fermer();
      effacer?.();
    });

    it("ajouter fichier à SFIP", async () => {
      idc = await appli.services["hélia"].ajouterFichierÀSFIP({
        contenu,
        nomFichier: "un fichier.txt",
      });
      expect(typeof idc).to.equal("string");

      const [idcRacine, nomFichier] = idc.split("/");
      expect(CID.parse(idcRacine) instanceof CID).to.be.true();
      expect(nomFichier).to.equal("un fichier.txt");
    });

    it("obtenir fichier de SFIP", async () => {
      const obtenu = await appli.services["hélia"].obtFichierDeSFIP({
        id: idc,
      });
      expect(new TextDecoder().decode(obtenu!)).to.equal(texte);
    });

    it("obtenir flux itérable de SFIP", async () => {
      const flux = await appli.services["hélia"].obtItérableAsyncSFIP({
        id: idc,
      });
      const obtenu = await toBuffer(flux);
      expect(new TextDecoder().decode(obtenu!)).to.equal(texte);
    });
  });
});
