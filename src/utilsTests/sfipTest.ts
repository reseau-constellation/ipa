import Ctl from "ipfsd-ctl";
import { NodeType } from "ipfsd-ctl/dist/src/types";

const FACTEUR = 2;

export const config = {
  timeout: 30 * 1000 * FACTEUR,
  patienceInit: 3 * 60 * 1000 * FACTEUR,
};

export const startIpfs = async (dossier = "") => {
  const controllerConfig: Ctl.ControllerOptions = {
    type: "proc" as NodeType,
    test: true,
    disposable: true,
    ipfsModule: await import("ipfs"),
    ipfsOptions: {
      repo: dossier,
      config: {
        Addresses: {
          API: "/ip4/127.0.0.1/tcp/0",
          Swarm: ["/ip4/0.0.0.0/tcp/0"],
          Gateway: "/ip4/0.0.0.0/tcp/0",
        },
        Bootstrap: [],
        Discovery: {
          MDNS: {
            Enabled: true,
            Interval: 0,
          },
          webRTCStar: {
            Enabled: false,
          },
        },
      },
    },
  };

  // Spawn an IPFS daemon (type defined in)
  const ipfsd = Ctl.createController(controllerConfig);
  return ipfsd;
};

export const stopIpfs = async (ipfsd: any) => {
  await ipfsd.stop();
};
