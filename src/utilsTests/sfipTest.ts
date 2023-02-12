import { create } from "ipfs-core";
import type { IPFS } from "ipfs-core";

const FACTEUR = 1;

export const config = {
  patience: 10 * 1000 * FACTEUR,
  patienceInit: 60 * 1000 * FACTEUR,
};

export const initierSFIP = async (dossier = ""): Promise<IPFS> => {
  return create({
    repo: dossier,
    init: {
      profiles: ["test"]
    }
  });
};

export const arrêterSFIP = async (sfip: IPFS) => {
  await sfip.stop();
};
