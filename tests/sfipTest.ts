import Ctl from "ipfsd-ctl";

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
export const testAPIs = {
  "js-ipfs": {
    type: "proc",
    test: true,
    disposable: true,
    ipfsModule: require("ipfs"),
    ipfsOptions: {},
  },
};
export const startIpfs = async (type: string, config = {}) => {
  if (!testAPIs[type as keyof typeof testAPIs]) {
    throw new Error(
      `Wanted API type ${JSON.stringify(
        type
      )} is unknown. Available types: ${Object.keys(testAPIs).join(", ")}`
    );
  }

  const controllerConfig = testAPIs[type as keyof typeof testAPIs];
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
