import fs from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { isElectronMain, isNode } from "wherearewe";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";

import { dossierTempoPropre } from "test/v2/utils.js";
import { ServiceDossier } from "@/v2/nébuleuse/services/dossier.js";
import type Quibble from "quibble";

describe("Dossier", function () {
    let quibble: typeof Quibble;

    let appli: Appli<{dossier: ServiceDossier}>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());

      if (isNode || isElectronMain) {
        quibble = await import("quibble");

        const envPathsTest = (name: string) => ({ data: join(dossier, name) });
        await quibble.default.esm("env-paths", {}, envPathsTest);
      }
    });

    afterEach(async () => {
      if (appli) await appli.fermer();
      if (effacer) effacer();
      quibble?.default.reset();
    });

    it("valeur par défaut", async () => {
      appli = new Appli<{dossier: ServiceDossier}>({ services: {
        dossier: ServiceDossier,
      }, options: { services: {dossier: { dossier }} } });
      await appli.démarrer();

      const val = await appli.services["dossier"].dossier();
      expect(val).to.be.a("string");

      if (isElectronMain || isNode) expect(fs.existsSync(val));
    });

    it("création dossier si non existant", async () => {
      const dossierAppli = join(dossier, "sous", "dossier");
      appli = new Appli<{dossier: ServiceDossier}>({ options: { services: {dossier: { dossier }} } });
      await appli.démarrer();

      const val = await appli.services["dossier"].dossier();
      expect(val).to.equal(dossierAppli);

      if (isElectronMain || isNode) expect(fs.existsSync(val));
    });

    it("utilisation nom appli", async () => {
      appli = new Appli({ options: { nomAppli: "Mon appli" } });
      await appli.démarrer();

      const val = await appli.services["dossier"].dossier();
      expect(val).to.be.a("string");
      if (isElectronMain || isNode)
        expect(val).to.equal(join(dossier, "Mon appli", "Mon appli"));
      else expect(val).to.equal(`./Mon appli`);
    });

    it("mode développement", async () => {
      appli = new Appli({
        options: { nomAppli: "Mon appli", mode: "dév" },
      });
      await appli.démarrer();

      const val = await appli.services["dossier"].dossier();
      expect(val).to.be.a("string");
      if (isElectronMain || isNode)
        expect(val).to.equal(join(dossier, "Mon appli", "Mon appli-dév"));
      else expect(val).to.equal(`./Mon appli`);
    });
  });