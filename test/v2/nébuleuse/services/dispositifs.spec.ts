import { expect } from "aegir/chai";
import { isBrowser, isElectronMain, isNode } from "wherearewe";
import {
  ServiceCompte,
  ServiceHélia,
  ServiceOrbite,
  ServiceStockage,
} from "@/v2/nébuleuse/index.js";
import {
  ServiceDispositifs,
  détecterTypeDispositif,
} from "@/v2/nébuleuse/services/dispositifs.js";
import { Appli } from "@/v2/appli/index.js";
import { ServiceJournal } from "@/v2/nébuleuse/services/journal.js";
import { dossierTempoPropre, obtenir } from "../../utils.js";
import { ServiceLibp2pTest } from "./utils.js";
import type { ServicesNécessairesDispositifs } from "@/v2/nébuleuse/services/dispositifs.js";
import type { ServicesLibp2pTest } from "@constl/utils-tests";

describe.only("Dispositifs", function () {
  describe("infos dispositifs", function () {
    let appli: Appli<
      ServicesNécessairesDispositifs<ServicesLibp2pTest>
    >;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      appli = new Appli<
        ServicesNécessairesDispositifs<ServicesLibp2pTest>
      >({
        services: {
          journal: ServiceJournal,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          orbite: ServiceOrbite,
          compte: ServiceCompte,
          dispositifs: ServiceDispositifs,
        },
        options: {
          dossier,
        },
      });
      await appli.démarrer();
    });

    after(async () => {
      await appli.fermer();
      effacer();
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
