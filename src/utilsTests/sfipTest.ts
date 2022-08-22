import Ctl from "ipfsd-ctl";
import { NodeType } from "ipfsd-ctl/dist/src/types";

export const config = {
  timeout: 30000,
  identityKeyFixtures: "./test/fixtures/keys/identity-keys",
  signingKeyFixtures: "./test/fixtures/keys/signing-keys",
  identityKeysPath: "./orbitdb/identity/identitykeys",
  signingKeysPath: "./orbitdb/identity/signingkeys",
  daemon1: {
    EXPERIMENTAL: {
      pubsub: true,
    },
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
  daemon2: {
    EXPERIMENTAL: {
      pubsub: true,
    },
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

export const startIpfs = async (config = {}) => {
  const controllerConfig = {
    type: "proc" as NodeType,
    test: true,
    disposable: true,
    ipfsModule: await import("ipfs"),
    ipfsOptions: {},
  };
  controllerConfig.ipfsOptions = config;

  // Spawn an IPFS daemon (type defined in)
  const ipfsd = Ctl.createController(controllerConfig);
  return ipfsd;
};

export const stopIpfs = async (ipfsd: any) => {
  if (!ipfsd) {
    return Promise.resolve();
  }

  setTimeout(async () => {
    await ipfsd.stop();
  }, 0);
};
