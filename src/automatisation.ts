import { v4 as uuidv4 } from "uuid";
import PQueue from "p-queue";

import type { Constellation } from "@/client.js";

const lancerAutomatisation = async <T extends SpécificationAutomatisation>({
  spéc,
  idSpéc,
  client,
  fÉtat,
}: {
  spéc: T;
  idSpéc: string;
  client: Constellation;
  fÉtat: (état: ÉtatAutomatisation) => void;
}): Promise<{
  fOublier: schémaFonctionOublier;
  fLancer: () => Promise<void>;
}> => {
  const queue = new PQueue({ concurrency: 1 });
  const requêteDernièreModifImportée = await client.obtDeStockageLocal({
    clef: clefStockageDernièreFois,
  });
  const requêtesDéjàExécutées = new Set([requêteDernièreModifImportée]);

  const fAutoAvecÉtats = async (requête: string) => {
    if (requêtesDéjàExécutées.has(requête)) return;
    if (requêtesDéjàExécutées.has(requête)) {
      return;
    }
    await client.sauvegarderAuStockageLocal({
      clef: clefStockageDernièreFois,
      val: requête,
    });
    requêtesDéjàExécutées.add(requête);
  };

  const fLancer = () => queue.add(async () => await fAutoAvecÉtats(uuidv4()));
};
