/*
La majorité de ce fichier provient d'OrbitDB

MIT License

Copyright (c) 2019 Haja Networks Oy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { yamux } from "@chainsafe/libp2p-yamux";
import { createLibp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";
import { circuitRelayServer } from "@libp2p/circuit-relay-v2";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { identify } from "@libp2p/identify";
import { createFromPrivKey } from "@libp2p/peer-id-factory";
import { unmarshalPrivateKey } from "@libp2p/crypto/keys";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";

// output of: console.log(server.peerId.privateKey.toString('hex'))
const relayPrivKey =
  "08011240821cb6bc3d4547fcccb513e82e4d718089f8a166b23ffcd4a436754b6b0774cf07447d1693cd10ce11ef950d7517bad6e9472b41a927cd17fc3fb23f8c70cd99";
// the peer id of the above key
// const relayId = '12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE'

const encoded = uint8ArrayFromString(relayPrivKey, "hex");
const privateKey = await unmarshalPrivateKey(encoded);
const peerId = await createFromPrivKey(privateKey);

const server = await createLibp2p({
  peerId,
  addresses: {
    listen: ["/ip4/0.0.0.0/tcp/12345/ws"],
  },
  transports: [
    webSockets({
      filter: filters.all,
    }),
  ],
  connectionEncryption: [noise()],
  streamMuxers: [yamux()],
  services: {
    identify: identify(),
    relay: circuitRelayServer({
      reservations: {
        maxReservations: 5000,
        reservationTtl: 1000,
        defaultDataLimit: BigInt(1024 * 1024 * 1024),
      },
    }),
  },
});

server.addEventListener("peer:connect", async (event) => {
  console.log("peer:connect", event.detail);
});

server.addEventListener("peer:disconnect", async (event) => {
  console.log("peer:disconnect", event.detail);
  server.peerStore.delete(event.detail);
});

console.log(server.peerId.toString());
console.log(
  "p2p addr: ",
  server.getMultiaddrs().map((ma) => ma.toString()),
);
// generates a deterministic address: /ip4/127.0.0.1/tcp/33519/ws/p2p/12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE
