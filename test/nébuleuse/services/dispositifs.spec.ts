import { expect } from "aegir/chai";
import { isBrowser, isElectronMain, isNode } from "wherearewe";
import { dossierTempoPropre, obtenir } from "@constl/utils-tests";
import {
  détecterTypeDispositif,
  serviceDispositifs,
} from "../../../src/nébuleuse/services/dispositifs.ts";
import { Appli } from "../../../src/nébuleuse/appli/index.ts";
import { serviceJournal } from "../../../src/nébuleuse/services/journal.ts";
import { serviceDossier } from "../../../src/nébuleuse/services/dossier.ts";
import { serviceCompte } from "../../../src/nébuleuse/services/compte/compte.ts";
import { serviceOrbite } from "../../../src/nébuleuse/services/orbite/orbite.ts";
import { serviceStockage } from "../../../src/nébuleuse/services/stockage.ts";
import { schémaNébuleuse } from "../../../src/nébuleuse/nébuleuse.ts";
import {
  serviceLibp2p,
  type ServicesLibp2pNébuleuse,
} from "../../../src/nébuleuse/services/libp2p/libp2p.ts";
import { serviceHéliaTest } from "./utils.ts";
import type { StructureNébuleuse } from "../../../src/nébuleuse/nébuleuse.ts";
import type {
  ServicesNécessairesDispositifs,
  ServiceDispositifs,
} from "../../../src/nébuleuse/services/dispositifs.ts";

describe("Dispositifs", function () {
  describe("infos dispositifs", function () {
    let appli: Appli<
      ServicesNécessairesDispositifs & { dispositifs: ServiceDispositifs }
    >;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      appli = new Appli<
        ServicesNécessairesDispositifs & { dispositifs: ServiceDispositifs }
      >({
        services: {
          dossier: serviceDossier({ dossier }),
          journal: serviceJournal(),
          stockage: serviceStockage(),
          libp2p: serviceLibp2p<ServicesLibp2pNébuleuse>(),
          hélia: serviceHéliaTest(),
          orbite: serviceOrbite<ServicesLibp2pNébuleuse>(),
          compte: serviceCompte<StructureNébuleuse>({
            schéma: schémaNébuleuse,
          }),
          dispositifs: serviceDispositifs(),
        },
      });
      await appli.démarrer();
    });

    after(async () => {
      await appli?.fermer();
      effacer?.();
    });

    it("autodétecter type", () => {
      const typeDétecté = détecterTypeDispositif();

      if (isNode) expect(typeDétecté).to.equal("serveur");
      else if (isElectronMain) expect(typeDétecté).to.equal("ordinateur");
      else if (isBrowser) expect(typeDétecté).to.equal("navigateur");
    });

    it("sauvegarder nom", async () => {
      const dispositifs = appli.services["dispositifs"];
      await dispositifs.sauvegarderNomDispositif({ nom: "Mon ordinateur" });

      const { nom } = await obtenir<{ nom?: string; type?: string }>(
        ({ siDéfini }) =>
          dispositifs.suivreInfoDispositif({
            f: siDéfini(),
          }),
      );

      expect(nom).to.equal("Mon ordinateur");
    });

    it("sauvegarder type", async () => {
      const dispositifs = appli.services["dispositifs"];
      await dispositifs.sauvegarderTypeDispositif({ type: "Fairphone" });

      const { type } = await obtenir<{ nom?: string; type?: string }>(
        ({ si }) =>
          dispositifs.suivreInfoDispositif({
            f: si((x) => !!x?.type),
          }),
      );

      expect(type).to.equal("Fairphone");
    });
  });
});
