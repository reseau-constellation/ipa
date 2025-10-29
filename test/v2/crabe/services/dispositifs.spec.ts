import { ServicesLibp2pTest, dossierTempo } from "@constl/utils-tests";
import { obtenir } from "@constl/utils-ipa";
import { expect } from "aegir/chai";
import { isBrowser, isElectronMain, isNode } from "wherearewe";
import {
  ServiceCompte,
  ServiceHélia,
  ServiceOrbite,
  ServiceStockage,
} from "@/v2/crabe/index.js";
import {
  ServiceDispositifs,
  ServicesNécessairesDispositifs,
  détecterTypeDispositif,
} from "@/v2/crabe/services/dispositifs.js";
import { Nébuleuse } from "@/v2/nébuleuse/index.js";
import { ServiceJournal } from "@/v2/crabe/services/journal.js";
import { dossierTempoPropre } from "../../utils.js";
import { ServiceLibp2pTest } from "./utils.js";

describe.only("Dispositifs", function () {
  describe("infos dispositifs", function () {
    let nébuleuse: Nébuleuse<
      ServicesNécessairesDispositifs<ServicesLibp2pTest>
    >;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      nébuleuse = new Nébuleuse<
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
      await nébuleuse.démarrer();
    });

    after(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("autodétecter type", () => {
      const typeDétecté = détecterTypeDispositif();

      if (isNode) expect(typeDétecté).to.equal("serveur");
      else if (isElectronMain) expect(typeDétecté).to.equal("ordinateur");
      else if (isBrowser) expect(typeDétecté).to.equal("navigateur");
    });

    it("sauvegarder nom", async () => {
      const dispositifs = nébuleuse.services["dispositifs"];
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
      const dispositifs = nébuleuse.services["dispositifs"];
      await dispositifs.sauvegarderTypeDispositif({ type: "Fairphone" });

      const { type } = await obtenir<
        { nom?: string; type?: string } | undefined
      >(({ si }) =>
        dispositifs.suivreInfoDispositif({
          f: si((x) => !!x?.type),
        }),
      );

      expect(type).to.equal("Fairphone");
    });
  });
});
