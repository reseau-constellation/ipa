import { initSFIP } from "../src/sfip/index.js";
import { expect } from "aegir/chai";
import type { Helia } from "helia";
import { isElectronMain, isNode } from "wherearewe";
import { dossiers } from "@constl/utils-tests";

describe.only("SFIP", function () {
  let sfip: Helia;
  let dossier: string;
  let fEffacer: () => void;

  before(async () => {
    if (isNode || isElectronMain) {
      ({ dossier, fEffacer } = await dossiers.dossierTempo());
    } else {
      dossier = "dossierSFIP";
    }
    sfip = await initSFIP(dossier);
  });

  after(async () => {
    console.log("après test");
    await sfip.stop();
    console.log("après fermeture sfip");
    try {
      fEffacer?.();
      console.log("dossier effacé");
    } catch (e) {
      if (!(isNode || isElectronMain) || !(process.platform === "win32")) {
        throw e;
      }
    }
    console.log("fini après test");
  });

  it("Initialiser", async () => {
    const id = sfip.libp2p.peerId;
    expect(id).to.be.a.string;
  });

  it("Connexion à un navigateur", async () => {
    await new Promise<void>((résoudre) => {
      sfip.libp2p.addEventListener("peer:discovery", async () => {
        const pairs = sfip.libp2p.getPeers();
        console.log(pairs.map((p) => p.toString()));
        const trouvé = pairs.length > 1;
        // const trouvé = pairs.find((p) => p.toString().includes("relayId"));
        if (trouvé) {
          résoudre();
        }
      });
    });
  });
  it.skip("Connexion à Node.js");
  it.skip("Ça fonctionne localement hors ligne");
});
