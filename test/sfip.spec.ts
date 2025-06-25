import path from "path";
import { expect } from "aegir/chai";
import { Connection, Libp2p, Stream } from "@libp2p/interface";
import { dossiers } from "@constl/utils-tests";
import { v4 as uuidv4 } from "uuid";
import { isElectronMain, isNode } from "wherearewe";
import { pushable } from "it-pushable";
import { pipe } from "it-pipe";
import { Constellation, créerConstellation } from "@/index.js";
import { ServicesLibp2p, initSFIP } from "../src/sfip/index.js";
import { obtIdsPairs } from "./utils/utils.js";
import type { HeliaLibp2p } from "helia";

const attendre = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const attendreConnecté = async ({
  sfip,
  idPair,
}: {
  sfip: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  idPair: string;
}) => {
  await new Promise<void>((résoudre) => {
    const vérifierConnecté = () => {
      const pairs = sfip.libp2p.getPeers();
      console.log(
        "pairs :",
        pairs.map((p) => p.toString()),
        sfip.libp2p.getConnections().map((c) => c.remoteAddr.toString()),
      );
      const trouvé = pairs.find((p) => p.toString() === idPair);
      if (trouvé) {
        résoudre();
      }
    };
    sfip.libp2p.addEventListener("peer:connect", vérifierConnecté);

    vérifierConnecté();
  });
};

const testerGossipSub = async ({
  sfip,
  idPair,
}: {
  sfip: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  idPair: string;
}) => {
  const CANAL_TEST = "test:gossipsub";
  sfip.libp2p.services.pubsub.subscribe(CANAL_TEST);
  const message = uuidv4();
  let intervale: NodeJS.Timeout | undefined = undefined;

  const retour = await new Promise((résoudre) => {
    sfip.libp2p.services.pubsub.addEventListener("gossipsub:message", (m) => {
      if (m.detail.msg.topic === CANAL_TEST) {
        const messageRetour = JSON.parse(
          new TextDecoder().decode(m.detail.msg.data),
        ) as {
          idPair: string;
          type: string;
          message: string;
        };

        if (
          messageRetour.message.includes(message) &&
          messageRetour.idPair === idPair
        ) {
          if (intervale) clearInterval(intervale);
          résoudre(messageRetour);
        }
      }
    });
    intervale = setInterval(
      () =>
        sfip.libp2p.services.pubsub.publish(
          CANAL_TEST,
          new TextEncoder().encode(
            JSON.stringify({ idPair, message, type: "ping" }),
          ),
        ),
      500,
    );
  });
  expect(retour).to.deep.equal({ idPair, message, type: "pong" });
};

describe.skip("Connectivité SFIP", function () {
  let idPairNavig: string;
  let idPairNode: string;

  let sfip: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  let dossier: string;
  let fEffacer: () => void;

  before(async () => {
    ({ dossier, fEffacer } = await dossiers.dossierTempo());
    sfip = await initSFIP({ dossier: path.join(dossier, "sfip") });
    ({ idPairNavig, idPairNode } = await obtIdsPairs());
  });

  after(async () => {
    await sfip.stop();
    try {
      fEffacer?.();
    } catch (e) {
      if (!(isNode || isElectronMain) || !(process.platform === "win32")) {
        throw e;
      }
    }
  });

  it("Initialiser", async () => {
    const id = sfip.libp2p.peerId.toString();
    expect(id).to.be.a("string");
  });

  it.skip("Connexion à Node.js", async () => {
    await attendreConnecté({ sfip, idPair: idPairNode });
  });

  it("GossipSub avec Node.js", async () => {
    await testerGossipSub({ sfip, idPair: idPairNode });
  });

  it.skip("Connexion à un navigateur", async () => {
    await attendreConnecté({ sfip, idPair: idPairNavig });
  });

  it("Gossipsub avec navigateur", async () => {
    await testerGossipSub({ sfip, idPair: idPairNavig });
  });

  it.skip("Ça fonctionne localement hors ligne");
});

describe.skip("Stabilité client", function () {
  let client: Constellation;
  let dossier: string;
  let fEffacer: () => void;

  before(async () => {
    ({ dossier, fEffacer } = await dossiers.dossierTempo());
    client = créerConstellation({ dossier });
    await attendre(15000);
  });

  after(async () => {
    await client.fermer();
    try {
      fEffacer?.();
    } catch (e) {
      if (!(isNode || isElectronMain) || !(process.platform === "win32")) {
        throw e;
      }
    }
  });
  it("Réactivité continue", async () => {
    let avant = Date.now();
    let i = 0;
    while (i < 30) {
      await client.bds.créerBd({ licence: "ODbl-1_0" });
      const après = Date.now();
      console.log(après - avant);
      avant = après;
      i++;
    }
  });
});

describe.only("Connexions demi-ouvertes", function () {
  let sfip: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  let sfip2: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  let dossier: string;
  let fEffacer: () => void;

  before(async () => {
    ({ dossier, fEffacer } = await dossiers.dossierTempo());
    sfip = await initSFIP({ dossier: path.join(dossier, "sfip") });
    sfip2 = await initSFIP({ dossier: path.join(dossier, "sfip2") });
    sfip.libp2p.addEventListener("peer:discovery", (e) =>
      sfip.libp2p.dial(e.detail.id),
    );
    sfip2.libp2p.addEventListener("peer:discovery", (e) =>
      sfip2.libp2p.dial(e.detail.id),
    );
  });

  after(async () => {
    await sfip.stop();
    await sfip2.stop();
    try {
      fEffacer?.();
    } catch (e) {
      if (!(isNode || isElectronMain) || !(process.platform === "win32")) {
        throw e;
      }
    }
  });

  it("Transition à webrtc", async () => {
    await new Promise<void>((résoudre) => {
      setInterval(() => {
        const connexionsSfip1 = sfip.libp2p.getConnections();
        const connexionsSfip2 = sfip2.libp2p.getConnections();

        if (
          connexionsSfip1.some(
            (c) => c.remotePeer.toString() === sfip2.libp2p.peerId.toString(),
          ) &&
          connexionsSfip2.some(
            (c) => c.remotePeer.toString() === sfip.libp2p.peerId.toString(),
          )
        )
          résoudre();
      }, 1000);
    });

    const gérerProtocole = async ({
      connection,
      stream,
    }: {
      connection: Connection;
      stream: Stream;
    }) => {
      const idPairSource = String(connection.remotePeer);

      const flux = pushable();
      pipe(stream, async (source) => {
        for await (const value of source) {
          const octets = value.subarray();
          const messageDécodé = new TextDecoder().decode(octets);
          console.log("sfip 2 a reçu", {
            de: idPairSource,
            message: messageDécodé,
          });
        }
      });
      pipe(flux, stream);
      flux.push(new TextEncoder().encode("réponse"));
    };

    await sfip2.libp2p.handle("protocol test", gérerProtocole, {
      runOnLimitedConnection: true,
    });
    const flux = await sfip.libp2p.dialProtocol(
      sfip2.libp2p.peerId,
      "protocol test",
      { runOnLimitedConnection: true },
    );
    pipe(flux, async (source) => {
      for await (const value of source) {
        const octets = value.subarray();
        const messageDécodé = new TextDecoder().decode(octets);
        console.log("sfip 1 a reçu", { messageDécodé });
      }
    });
    const fluxÀÉcrire = pushable();
    pipe(fluxÀÉcrire, flux);

    await new Promise<void>((résoudre) => {
      setInterval(() => {
        const connexionsSfip1 = sfip.libp2p.getConnections();
        const connexionsSfip2 = sfip2.libp2p.getConnections();

        console.log(
          "connexionsSfip1",
          connexionsSfip1
            .filter(
              (c) => c.remotePeer.toString() === sfip2.libp2p.peerId.toString(),
            )
            .map((c) => ({
              remoteAddress: c.remoteAddr,
              status: c.status,
              direction: c.direction,
            })),
        );
        console.log(
          "connexionsSfip2",
          connexionsSfip2
            .filter(
              (c) => c.remotePeer.toString() === sfip.libp2p.peerId.toString(),
            )
            .map((c) => ({
              remoteAddress: c.remoteAddr,
              status: c.status,
              direction: c.direction,
            })),
        );

        if (
          connexionsSfip1.some((c) =>
            c.remoteAddr.toString().startsWith("/webrtc"),
          ) ||
          connexionsSfip2.some((c) =>
            c.remoteAddr.toString().startsWith("/webrtc"),
          )
        )
          résoudre();
      }, 1000);
    });
    fluxÀÉcrire.push(new TextEncoder().encode("message pour sfip 2"));

    sfip.libp2p.services.pubsub.subscribe("canal test");
    sfip2.libp2p.services.pubsub.subscribe("canal test");
    sfip.libp2p.services.pubsub.addEventListener("message", (e) => {
      if (e.detail.topic === "canal test") {
        console.log(
          "sfip 1 a reçu gossipsub",
          new TextDecoder().decode(e.detail.data),
        );
      }
    });
    sfip2.libp2p.services.pubsub.addEventListener("message", (e) => {
      if (e.detail.topic === "canal test") {
        console.log(
          "sfip 2 a reçu gossipsub",
          new TextDecoder().decode(e.detail.data),
        );
      }
    });
    setInterval(() => {
      sfip.libp2p.services.pubsub.publish(
        "canal test",
        Buffer.from(new TextEncoder().encode("message de sfip 1")),
      );
      sfip2.libp2p.services.pubsub.publish(
        "canal test",
        Buffer.from(new TextEncoder().encode("message de sfip 2")),
      );
    }, 1000);

    await new Promise<void>((résoudre) => setTimeout(résoudre, 5000));
  });
});
