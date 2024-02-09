import initSFIP from "../src/sfip/index.js";
import { expect } from "aegir/chai";
import type { Helia } from "helia";
import { isElectronMain, isNode } from "wherearewe";
import { multiaddr } from "@multiformats/multiaddr";
import { dossiers } from "@constl/utils-tests";

describe.skip("SFIP", function () {
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
    // Ça coince pour toujours avec Électron principal. Peut-être que ça sera mieux avec Hélia...
    if (!isElectronMain) await sfip.stop();
    fEffacer?.();
  });

  it("Initialiser", async () => {
    const id = await sfip.libp2p.peerId;
    expect(id).to.be.a.string;
  });

  it("Connexion à un navigateur", async () => {
    const relayId = "12D3KooWPQJMHevU1JcDHH11taaS75FxEM27ar9qTrXTnTi9UGhc";

    await sfip.libp2p.dial(
      multiaddr(`/dns4/relai-libp2p.xn--rseau-constellation-bzb.ca/tcp/443/wss/p2p/${relayId}`),
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
});
