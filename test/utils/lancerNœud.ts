import { initSFIP } from "@/sfip/index.js";
import { unmarshalPrivateKey } from "@libp2p/crypto/keys";
import { createFromPrivKey } from "@libp2p/peer-id-factory";
import {
  fromString as uint8ArrayFromString,
  toString as uint8ArrayToString,
} from "uint8arrays";
import { isBrowser } from "wherearewe";

const obtIdPair = async () => {
  const clefSecrète = isBrowser
    ? "08011240d098f4a94f3bdac9cada1b289189d3f310f48cfea55aaba00a30bc904075d61ef3668c7bf19999f91bb23ebab128bc24ced9eedbe59237bd0e11a4c152c255b6"
    : "08011240966c7e0c39ec1347890bf503fa8786c1a3657ca5da57b0c7c9ff8f95a80dde6e43ac4da8ae070eb852daa7077750535b3ed71bd389108da8c24bf741ff18f00d";
  if (!clefSecrète) return undefined;
  const encoded = uint8ArrayFromString(clefSecrète, "hex");
  const privateKey = await unmarshalPrivateKey(encoded);
  const idPair = await createFromPrivKey(privateKey);
  return idPair;
};
const CANAL_TEST = "test:gossipsub";

const dossier = isBrowser
  ? "./testSfip"
  : process.argv.indexOf("--dossier")
    ? process.argv[process.argv.indexOf("--dossier") + 1]
    : "./testSfip";

obtIdPair().then((peerId) =>
  initSFIP({ dossier, configLibp2p: { peerId } }).then(async (sfip) => {
    console.log(
      "SFIP initialisé avec id de nœud :",
      sfip.libp2p.peerId.toString(),
    );
    if (!peerId) {
      console.log(
        "clef privée : ",
        uint8ArrayToString(sfip.libp2p.peerId!.privateKey!, "hex"),
      );
    }
    console.log(
      "nos adresses: ",
      sfip.libp2p.peerId.toString(),
      sfip.libp2p.getMultiaddrs().map((ma) => ma.toString()),
    );
    sfip.libp2p.addEventListener("peer:connect", async () => {
      /*const pairs = sfip.libp2p.getPeers();
      const connexions = sfip.libp2p.getConnections();
      console.log(
        "pairs : ",
        pairs.map((p) => p.toString()),
      );
      console.log(
        "connexions : ",
        JSON.stringify(
          connexions.map((c) => [
            c.remotePeer.toString(),
            c.remoteAddr.toString(),
          ]),
          undefined,
          2,
        ),
      );
      */
    });
    sfip.libp2p.services.pubsub.subscribe(CANAL_TEST);
    sfip.libp2p.services.pubsub.addEventListener("gossipsub:message", (m) => {
      /*console.log(
        m.detail.msg.topic,
        new TextDecoder().decode(m.detail.msg.data),
      );*/
      if (m.detail.msg.topic === CANAL_TEST) {
        const idPair = sfip.libp2p.peerId.toString();
        const message = JSON.parse(
          new TextDecoder().decode(m.detail.msg.data),
        ) as { idPair: string; type: string; message: string };
        if (message.type === "ping" && message.idPair === idPair) {
          sfip.libp2p.services.pubsub.publish(
            CANAL_TEST,
            new TextEncoder().encode(
              JSON.stringify({
                message: message.message,
                idPair,
                type: "pong",
              }),
            ),
          );
        }
      }
    });
  }),
);
