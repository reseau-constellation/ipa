import path from "path";
import { expect } from "aegir/chai";
import { Connection, Libp2p, PeerId, Stream } from "@libp2p/interface";
import { dossiers } from "@constl/utils-tests";
import { v4 as uuidv4 } from "uuid";
import { isElectronMain, isNode } from "wherearewe";
import { pushable } from "it-pushable";
import { pipe } from "it-pipe";
import { Multiaddr } from "@multiformats/multiaddr";
import { TypedEmitter } from "tiny-typed-emitter";
import pRetry from "p-retry";
import { Constellation, créerConstellation } from "@/index.js";
import { ServicesLibp2p, initSFIP } from "../src/sfip/index.js";
import { obtIdsPairs } from "./utils/utils.js";
import type { Helia } from "helia";

const attendre = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const attendreConnecté = async ({
  sfip,
  idPair,
}: {
  sfip: Helia<Libp2p<ServicesLibp2p>>;
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
  sfip: Helia<Libp2p<ServicesLibp2p>>;
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

  let sfip: Helia<Libp2p<ServicesLibp2p>>;
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

describe("Connexions à moitié ouvertes", function () {
  let sfip: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  let sfip2: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  let fluxEntrée1: { stream: Stream };
  let fluxEntrée2: { stream: Stream };
  let fluxSortie1: { stream: Stream; connection: Connection };
  let fluxSortie2: { stream: Stream; connection: Connection };
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

  const connectéAuRelai = (pair: Libp2p<ServicesLibp2p>): Promise<void> => {
    const correspond = ({
      remoteAddr,
    }: {
      remotePeer: PeerId;
      remoteAddr: Multiaddr;
    }) =>
      remoteAddr
        .toString()
        .includes("relai-ws-libp2p.xn--rseau-constellation-bzb.ca");

    if (pair.getConnections().find((c) => correspond(c)))
      return Promise.resolve();

    return new Promise<void>((résoudre) => {
      pair.addEventListener(
        "connection:open",
        ({ detail: { remoteAddr, remotePeer } }) => {
          if (correspond({ remoteAddr, remotePeer })) résoudre();
        },
      );
    });
  };

  const connectésParRelai = (
    pair1: Libp2p<ServicesLibp2p>,
    pair2: Libp2p<ServicesLibp2p>,
  ): Promise<void> => {
    const correspond = ({
      remotePeer,
      remoteAddr,
    }: {
      remotePeer: PeerId;
      remoteAddr: Multiaddr;
    }) =>
      remotePeer.toString() === pair2.peerId.toString() &&
      remoteAddr.toString().includes("p2p-circuit");

    if (pair1.getConnections().find((c) => correspond(c)))
      return Promise.resolve();

    return new Promise<void>((résoudre) => {
      pair1.addEventListener(
        "connection:open",
        ({ detail: { remoteAddr, remotePeer } }) => {
          if (correspond({ remoteAddr, remotePeer })) résoudre();
        },
      );
    });
  };

  const connectésParWebrtc = (
    pair1: Libp2p<ServicesLibp2p>,
    pair2: Libp2p<ServicesLibp2p>,
  ): Promise<PeerId> => {
    const correspond = ({
      remotePeer,
      remoteAddr,
    }: {
      remotePeer: PeerId;
      remoteAddr: Multiaddr;
    }) =>
      remotePeer.toString() === pair2.peerId.toString() &&
      remoteAddr.toString().startsWith("/webrtc");

    if (pair1.getConnections().find((c) => correspond(c)))
      return Promise.resolve(pair1.peerId);

    return new Promise<PeerId>((résoudre) => {
      pair1.addEventListener(
        "connection:open",
        ({ detail: { remoteAddr, remotePeer } }) => {
          if (correspond({ remoteAddr, remotePeer })) résoudre(pair1.peerId);
        },
      );
    });
  };

  const abonnerGossipSub = (pair: Libp2p<ServicesLibp2p>, canal: string) => {
    pair.services.pubsub.subscribe(canal);
  };

  const abonnerFluxDirecte = async ({
    pair,
    protocole,
  }: {
    pair: Libp2p<ServicesLibp2p>;
    protocole: string;
  }): Promise<{
    stream: Stream;
    connection: Connection;
  }> => {
    await pair.register(protocole, {
      onConnect: (peer, connection) => {
        console.log(
          `sur pair ${pair.peerId.toString()} : pair ${peer.toString()} est souscrit à ${protocole} par connexion ${connection.remoteAddr.toString()}`,
        );
      },
      onDisconnect: (peer: PeerId) => {
        console.log(
          `sur pair ${pair.peerId.toString()} : pair ${peer.toString()} n'est plus souscrit à ${protocole}`,
        );
      },
    });

    const événements = new TypedEmitter<{ prêt: () => void }>();
    let réponse: { stream: Stream; connection: Connection };

    const gérerProtocole = async ({
      stream,
      connection,
    }: {
      stream: Stream;
      connection: Connection;
    }) => {
      console.log("gérer Protocole", stream.status);
      if (typeof réponse === "undefined") réponse = { stream, connection };
      réponse.stream = stream;
      réponse.connection = connection;
      événements.emit("prêt");
    };

    const promesse = new Promise<{
      stream: Stream;
      connection: Connection;
    }>((résoudre) => {
      événements.once("prêt", () => résoudre(réponse));
    });

    pair.handle(protocole, gérerProtocole, {
      runOnLimitedConnection: true,
      // force: true,
    });
    return promesse;
  };

  const signalerFluxDirecte = async ({
    de,
    à,
    protocole,
  }: {
    de: Libp2p<ServicesLibp2p>;
    à: Libp2p<ServicesLibp2p>;
    protocole: string;
  }): Promise<{ stream: Stream }> => {
    const retour = {
      stream: await pRetry(
        async () =>
          await de.dialProtocol(à.peerId, protocole, {
            runOnLimitedConnection: true,
          }),
      ),
    };

    de.addEventListener(
      "connection:close",
      async ({ detail: { remoteAddr, streams } }) => {
        console.log("connexion fermée, ", remoteAddr, streams);
        if (streams.some((s) => s.protocol === protocole)) {
          console.log("on regénère les connexions");
          retour.stream = await pRetry(
            async () =>
              await de.dialProtocol(à.peerId, protocole, {
                runOnLimitedConnection: true,
              }),
          );
          console.log("connexions regénérées");
        }
      },
    );
    return retour;
  };

  const vérifierGossipSub = async ({
    de,
    à,
    canal,
  }: {
    de: Libp2p<ServicesLibp2p>;
    à: Libp2p<ServicesLibp2p>;
    canal: string;
  }): Promise<void> => {
    const message = "message test " + uuidv4();
    const promesseReçu = new Promise<void>((résoudre) => {
      à.services.pubsub.addEventListener(
        "message",
        ({ detail: { topic, data } }) => {
          if (topic === canal && new TextDecoder().decode(data) === message) {
            clearInterval(intervale);
            résoudre();
          }
        },
      );
    });
    const intervale = setInterval(async () => {
      await de.services.pubsub.publish(
        canal,
        new TextEncoder().encode(message),
      );
    }, 500);
    return promesseReçu;
  };

  const vérifierFluxDirecte = ({
    fluxExpéditeur,
    fluxDestinataire,
  }: {
    fluxExpéditeur: Stream;
    fluxDestinataire: Stream;
  }) => {
    console.log({ fluxExpéditeur: fluxExpéditeur.status });
    console.log({ fluxDestinataire: fluxDestinataire.status });
    const message = "message protocole " + uuidv4();

    const promesse = new Promise<void>((résoudre) => {
      pipe(fluxDestinataire, async (source) => {
        for await (const value of source) {
          const octets = value.subarray();
          const messageDécodé = new TextDecoder().decode(octets);
          if (messageDécodé === message) résoudre();
        }
      });
    });
    const écrivable = pushable();
    pipe(écrivable, fluxExpéditeur);
    écrivable.push(new TextEncoder().encode(message));
    return promesse;
  };
  const CANAL_TEST = "canal test " + uuidv4();
  const PROTOCOLE_TEST = "protocole test " + uuidv4();

  it("Connectés au relai", async () => {
    await Promise.all([sfip.libp2p, sfip2.libp2p].map(connectéAuRelai));
  });

  it("Connectés à travers le relai", async () => {
    await Promise.all([
      connectésParRelai(sfip.libp2p, sfip2.libp2p),
      connectésParRelai(sfip2.libp2p, sfip.libp2p),
    ]);
  });

  it("Abonnés à GossipSub", async () => {
    abonnerGossipSub(sfip.libp2p, CANAL_TEST);
    abonnerGossipSub(sfip2.libp2p, CANAL_TEST);
  });

  it("Communication GossipSub sur le relai", async () => {
    await Promise.all([
      vérifierGossipSub({
        de: sfip.libp2p,
        à: sfip2.libp2p,
        canal: CANAL_TEST,
      }),
      vérifierGossipSub({
        de: sfip2.libp2p,
        à: sfip.libp2p,
        canal: CANAL_TEST,
      }),
    ]);
  });

  it("Abonner aux flux directes", async () => {
    const promesseFluxSortie1 = abonnerFluxDirecte({
      pair: sfip.libp2p,
      protocole: PROTOCOLE_TEST,
    });
    const promesseFluxSortie2 = abonnerFluxDirecte({
      pair: sfip2.libp2p,
      protocole: PROTOCOLE_TEST,
    });
    fluxEntrée1 = await signalerFluxDirecte({
      de: sfip.libp2p,
      à: sfip2.libp2p,
      protocole: PROTOCOLE_TEST,
    });
    fluxEntrée2 = await signalerFluxDirecte({
      de: sfip2.libp2p,
      à: sfip.libp2p,
      protocole: PROTOCOLE_TEST,
    });
    fluxSortie1 = await promesseFluxSortie1;
    fluxSortie2 = await promesseFluxSortie2;
  });

  it("Communication flux directes sur le relai", async () => {
    await vérifierFluxDirecte({
      fluxExpéditeur: fluxEntrée1.stream,
      fluxDestinataire: fluxSortie2.stream,
    });
    console.log("Flux directe fonctionne sur relai 1 -> 2");
    await vérifierFluxDirecte({
      fluxExpéditeur: fluxEntrée2.stream,
      fluxDestinataire: fluxSortie1.stream,
    });
    console.log("Flux directe fonctionne sur relai 2 -> 1");
  });

  it("Transition à WebRTC", async () => {
    // Vérifier toujours connectés au relai
    await connectésParRelai(sfip.libp2p, sfip2.libp2p);
    await connectésParRelai(sfip2.libp2p, sfip.libp2p);

    // Attendre connectés directement
    const pairWebRTC = await Promise.race([
      connectésParWebrtc(sfip.libp2p, sfip2.libp2p),
      connectésParWebrtc(sfip2.libp2p, sfip.libp2p),
    ]);
    console.log(
      `connectés par webrtc ${[sfip.libp2p.peerId, sfip2.libp2p.peerId].indexOf(pairWebRTC) + 1}`,
    );
  });

  it("Communication GossipSub sur webrtc", async () => {
    await Promise.all([
      vérifierGossipSub({
        de: sfip.libp2p,
        à: sfip2.libp2p,
        canal: CANAL_TEST,
      }),
      vérifierGossipSub({
        de: sfip2.libp2p,
        à: sfip.libp2p,
        canal: CANAL_TEST,
      }),
    ]);
  });

  it("Communication flux directes sur webrtc", async () => {
    await vérifierFluxDirecte({
      fluxExpéditeur: fluxEntrée1.stream,
      fluxDestinataire: fluxSortie2.stream,
    });
    console.log("Flux directe fonctionne 1 -> 2");
    await vérifierFluxDirecte({
      fluxExpéditeur: fluxEntrée2.stream,
      fluxDestinataire: fluxSortie1.stream,
    });
    console.log("Flux directe fonctionne 2 -> 1");
  });
});
