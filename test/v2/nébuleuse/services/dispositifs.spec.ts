import { expect } from "aegir/chai";
import { isBrowser, isElectronMain, isNode } from "wherearewe";
import {
  détecterTypeDispositif,
  serviceDispositifs,
} from "@/v2/nébuleuse/services/dispositifs.js";
import { Appli } from "@/v2/nébuleuse/appli/index.js";
import { serviceJournal } from "@/v2/nébuleuse/services/journal.js";
import { serviceDossier } from "@/v2/nébuleuse/services/dossier.js";
import { serviceCompte } from "@/v2/nébuleuse/services/compte/compte.js";
import { serviceOrbite } from "@/v2/nébuleuse/services/orbite/orbite.js";
import { serviceStockage } from "@/v2/nébuleuse/services/stockage.js";
import { schémaNébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { serviceLibp2p, type ServicesLibp2pNébuleuse } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import { dossierTempoPropre, obtenir } from "../../utils.js";
import { serviceHéliaTest } from "./utils.js";
import type { StructureNébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import type {
  ServicesNécessairesDispositifs,
  ServiceDispositifs,
} from "@/v2/nébuleuse/services/dispositifs.js";

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
