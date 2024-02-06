import initSFIP from "../src/sfip/index.js";
import { expect } from "aegir/chai";
import type { Helia } from "helia";
import { isElectronMain, isNode } from "wherearewe";
import { multiaddr } from "@multiformats/multiaddr";

describe.skip("SFIP", function () {
  let sfip: Helia;
  let dossier: string;

  before(async () => {
    if (isNode || isElectronMain) {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      dossier = fs.mkdtempSync(path.join(os.tmpdir(), "constl-ipa-"));
    } else {
      dossier = "dossierSFIP";
    }
    sfip = await initSFIP(dossier);
  });

  it("Initialiser", async () => {
    const id = await sfip.libp2p.peerId;
    expect(id).to.be.a.string;
  });

  it("Connexion à un navigateur", async () => {
    const relayId = "12D3KooWPQJMHevU1JcDHH11taaS75FxEM27ar9qTrXTnTi9UGhc";

    await sfip.libp2p.dial(
      multiaddr(
        `/dns4/relailibp2p-m7f59ma6.b4a.run/tcp/53321/ws/p2p/${relayId}`,
      ),
    );

    await new Promise<void>((résoudre) => {
      sfip.libp2p.addEventListener("peer:discovery", async () => {
        const pairs = sfip.libp2p.getPeers();
        console.log(pairs);
        const trouvé = pairs.find((p) => p.toString().includes(relayId));
        if (trouvé) {
          résoudre();
        }
      });
    });
  });
  after(async () => {
    // Ça coince pour toujours avec Électron principal. Peut-être que ça sera mieux avec Hélia...
    if (!isElectronMain) await sfip.stop();
    if (dossier) {
      if (isNode) {
        // Pas pour Électron principal parce que nous n'avons pas appellé sfip.stop() ci-dessus
        const { sync } = await import("rimraf");
        sync(dossier);
      }
    }
  });
});
