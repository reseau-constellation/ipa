import { ServicesLibp2p, initSFIP } from "../src/sfip/index.js";
import { expect } from "aegir/chai";
import type { Helia } from "helia";
import { isElectronMain, isNode } from "wherearewe";
import { dossiers } from "@constl/utils-tests";
import { initOrbite } from "@/orbite.js";
import { Libp2p } from "@libp2p/interface";
import { créerConstellation } from "@/index.js";
import path, { join } from "path";
import { v4 as uuidv4} from "uuid";

describe.only("SFIP", function () {
  let sfip: Helia<Libp2p<ServicesLibp2p>>;
  let dossier: string;
  let fEffacer: () => void;

  before(async () => {
    if (isNode || isElectronMain) {
      ({ dossier, fEffacer } = await dossiers.dossierTempo());
    } else {
      dossier = "dossierSFIP";
    }
    sfip = await initSFIP(path.join(dossier, "sfip"));
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
        const connexions = sfip.libp2p.getConnections().map(c=>[c.remotePeer.toString(), c.remoteAddr.toString()]);
        console.log("principal: ", {connexions})
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
  it("Gossipsub", async () => {
    sfip.libp2p.services.pubsub.subscribe("test")
    const message = uuidv4();
    const retour = await new Promise(résoudre => {
      sfip.libp2p.services.pubsub.addEventListener("gossipsub:message", m => {
        console.log(m.detail.msg.topic, new TextDecoder().decode(m.detail.msg.data));
        if (m.detail.msg.topic === "test") {
          const messageRetour = new TextDecoder().decode(m.detail.msg.data)
          if (messageRetour.includes(message)) résoudre(messageRetour)
        }
      });
      sfip.libp2p.services.pubsub.publish("test", new TextEncoder().encode(message));
    })
    expect(retour).to.equal("Retour : " + message)
    return
    
    const constl = créerConstellation({ orbite: await initOrbite({ sfip, dossierOrbite: join(dossier, "./orbite") }), dossier});
    await constl.réseau.suivreConnexionsPostesSFIP({
      f: sfips => console.log({sfips})
    })
    const noms = await new Promise(résoudre => {

      constl.réseau.suivreConnexionsMembres({
        f: async membres => {
          console.log(JSON.stringify({membres}, undefined, 2))
          return await constl.profil.suivreNoms({
            idCompte: membres[0].infoMembre.idCompte, 
            f: noms => {console.log({noms}); Object.keys(noms).includes("fr") && résoudre(noms)},
          })
        }
      })
    })
    console.log("ici", {noms})
  })
});
