import fs from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { isElectronMain, isNode } from "wherearewe";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";

import {
  FICHIER_VERROU,
  INTERVALE_VERROU,
  type ServiceDossier,
  serviceDossier,
} from "@/v2/nébuleuse/services/dossier.js";
import { dossierTempoPropre, utiliserFauxChronomètres } from "../../utils.js";
import type { SinonFakeTimers } from "sinon";
import type Quibble from "quibble";

describe.only("Dossier", function () {
  let horloge: SinonFakeTimers
  let quibble: typeof Quibble;

  let appli: Appli<{ dossier: ServiceDossier }>;
  let dossier: string;
  let effacer: () => void;

  beforeEach(async () => {
    horloge = utiliserFauxChronomètres();
    ({ dossier, effacer } = await dossierTempoPropre());

    if (isNode || isElectronMain) {
      quibble = await import("quibble");

      const envPathsTest = (name: string) => ({ data: join(dossier, name) });
      await quibble.default.esm("env-paths", {}, envPathsTest);
    }
  });

  afterEach(async () => {
    horloge.restore();
    if (appli) await appli.fermer();
    if (effacer) effacer();
    quibble?.default.reset();
  });

  it("valeur par défaut", async () => {
    appli = new Appli<{ dossier: ServiceDossier }>({
      services: {
        dossier: serviceDossier({ dossier }),
      },
    });
    await appli.démarrer();

    const val = await appli.services["dossier"].dossier();
    expect(val).to.be.a("string");

    if (isElectronMain || isNode) expect(fs.existsSync(val));
  });

  it("création dossier si non existant", async () => {
    const dossierAppli = join(dossier, "sous", "dossier");
    appli = new Appli<{ dossier: ServiceDossier }>({
      services: {
        dossier: serviceDossier({ dossier: dossierAppli }),
      },
    });
    await appli.démarrer();

    const val = await appli.services["dossier"].dossier();
    expect(val).to.equal(dossierAppli);

    if (isElectronMain || isNode) expect(fs.existsSync(val));
  });

  it("utilisation nom appli", async () => {
    appli = new Appli({
      services: {
        dossier: serviceDossier(),
      },
      options: { nomAppli: "Mon appli" },
    });
    await appli.démarrer();

    const val = await appli.services["dossier"].dossier();
    expect(val).to.be.a("string");
    if (isElectronMain || isNode)
      expect(val).to.equal(join(dossier, "Mon appli", "Mon appli"));
    else expect(val).to.equal(`./Mon appli`);
  });

  it("mode développement", async () => {
    appli = new Appli({
      services: {
        dossier: serviceDossier(),
      },
      options: { nomAppli: "Mon appli", mode: "dév" },
    });
    await appli.démarrer();

    const val = await appli.services["dossier"].dossier();
    expect(val).to.be.a("string");
    if (isElectronMain || isNode)
      expect(val).to.equal(join(dossier, "Mon appli", "Mon appli-dév"));
    else expect(val).to.equal(`./Mon appli`);
  });

  it("verrouillage dossier", async () => {
    const MESSAGE_ERREUR = "message erreur";
    appli = new Appli<{ dossier: ServiceDossier }>({
      services: {
        dossier: serviceDossier({ dossier }),
      },
    });
    await appli.démarrer();
    await appli.services.dossier.spécifierMessageVerrou({
      message: MESSAGE_ERREUR,
    });

    const fichierVerrou = join(dossier, FICHIER_VERROU);

    if (isElectronMain || isNode) expect(fs.existsSync(fichierVerrou));
    const appli2 = new Appli<{ dossier: ServiceDossier }>({
      services: {
        dossier: serviceDossier({ dossier }),
      },
    });

    const démarrage = appli2.démarrer()
    await horloge.tickAsync(INTERVALE_VERROU * 1.5);
    await expect(démarrage).to.eventually.be.rejectedWith(
      `Le compte sur ${dossier} est déjà ouvert par un autre processus.\n"${MESSAGE_ERREUR}"`,
    );
  });
});
