import { create } from "ipfs-core";
import type { IPFS } from "ipfs-core";

export const config = {
  patience: 10 * 1000,
  patienceInit: 60 * 1000,
};

export const initierSFIP = async (dossier = ""): Promise<IPFS> => {
  return create({
    repo: dossier,
    init: {
      profiles: ["test"],
    },
  });
};

export const arrêterSFIP = async (sfip: IPFS) => {
  await sfip.stop();
};
