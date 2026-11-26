import path from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import {
  créerHéliasTest,
  dossierTempo,
  dossierTempoPropre,
  que,
} from "@constl/utils-tests";

import { useFakeTimers } from "sinon";
import {
  isValidAddress,
  type BaseDatabase,
  type KeyValueDatabase,
} from "@orbitdb/core";
import {
  withLibp2pLight,
  type CreateLibp2pOptions,
  type HeliaWithLibp2p,
} from "@helia/libp2p";
import { withBitswap } from "@helia/bitswap";
import { createHeliaLight, type HeliaInit } from "helia";
import * as dagCbor from "@ipld/dag-cbor";
import * as dagJson from "@ipld/dag-json";
import * as json from "multiformats/codecs/json";
import { sha512 } from "multiformats/hashes/sha2";
import { expect } from "aegir/chai";
import { readFile as xlsxReadFile, type WorkBook } from "@e965/xlsx";
import JSZip from "jszip";
import { créerConstellation } from "@/index.js";
import { estContrôleurNébuleuse } from "@/nébuleuse/services/compte/accès/contrôleurNébuleuse.js";
import { ImportateurFeuilleCalcul } from "@/importateur/feuille.js";
import { connecterNébuleuses } from "./nébuleuse/utils.js";
import {
  obtenirOptionsLibp2pLocal,
  type ServicesLibp2pNébuleuseLocale,
} from "./nébuleuse/services/utils.js";
import type { Constellation } from "@/index.js";
import type { Constellation as ConstructeurConstellation } from "@/constellation.js";
import type { Oublier } from "@/nébuleuse/types.js";
import type { OrderedKeyValueDatabaseType } from "@orbitdb/ordered-keyvalue-db";
import type { FeedDatabaseType } from "@orbitdb/feed-db";
import type { SetDatabaseType } from "@orbitdb/set-db";
import type { ServicesLibp2pNébuleuse } from "@/nébuleuse/services/libp2p/libp2p.js";
import type { ÉlémentDonnéesTableau } from "@/bds/tableaux.js";

export const journalifier = <T extends (...args: unknown[]) => unknown>(
  f: T,
  étiquette?: string,
): T => {
  return ((...args) => {
    console.log(étiquette || "", args);
    return f(...args);
  }) as T;
};

export const attendreInvité = async (
  bd: BaseDatabase,
  idInvité: string,
): Promise<void> => {
  const accès = bd.access;
  if (!estContrôleurNébuleuse(accès))
    throw new Error(`Contrôleur d'accès non supporté : ${accès.type}`);

  const estInvité = async () => {
    return isValidAddress(idInvité)
      ? !!accès.accès.utilisateurs.find((u) => u.idCompte === idInvité)
      : !!accès.accès.dispositifs.find((d) => d.idDispositif === idInvité);
  };
  return await que(estInvité);
};

export const peutÉcrire = async (
  bd:
    | KeyValueDatabase
    | SetDatabaseType
    | FeedDatabaseType
    | OrderedKeyValueDatabaseType,
): Promise<boolean> => {
  try {
    if (bd.type === "keyvalue" || bd.type === "ordered-keyvalue") {
      // Important d'avoir une clef unique pour éviter l'interférence entre les tests
      const CLEF = "test" + Math.random().toString();
      const VAL = 123;

      await bd.set(CLEF, VAL);
      const val = await bd.get(CLEF);

      await bd.del(CLEF);
      return val === VAL;
    } else if (bd.type === "feed") {
      const VAL = "test";

      await bd.add(VAL);
      const éléments = await bd.all();

      const autorisé = éléments.length === 1 && éléments[0].value === VAL;
      if (éléments.length === 1) {
        await bd.remove(éléments[0].hash);
      }
      return autorisé;
    } else if (bd.type === "set") {
      const VAL = "test";

      await bd.add(VAL);
      const éléments = await bd.all();

      const autorisé = éléments.size === 1 && éléments.has(VAL);
      await bd.del(VAL);

      return autorisé;
    } else {
      // @ts-expect-error bd.type n'a plus d'options
      throw new Error(`Type de BD ${bd.type} non supporté par ce test.`);
    }
  } catch (e) {
    if (e.toString().includes("is not allowed to write to the log")) {
      return false;
    }
    throw e;
  }
};

type CréerConstellationsTest<
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
> = {
  (args: {
    n: number;
    persistante?: boolean;
    avecMandataire: false;
    mode?: "dév" | "prod";
  }): Promise<{
    constls: ConstructeurConstellation<L>[];
    fermer: Oublier;
  }>;
  (args: {
    n: number;
    persistante?: boolean;
    avecMandataire?: true;
    mode?: "dév" | "prod";
  }): Promise<{
    constls: Constellation<L>[];
    fermer: Oublier;
  }>;
  (args: {
    n: number;
    persistante?: boolean;
    avecMandataire?: boolean;
    mode?: "dév" | "prod";
  }): Promise<{
    constls: (Constellation<L> | ConstructeurConstellation<L>)[];
    fermer: Oublier;
  }>;
};

export const créerConstellationsTest: CréerConstellationsTest = async ({
  n,
  avecMandataire = true,
  persistante = false,
}) => {
  const { dossier, effacer } = await dossierTempoPropre();

  const constls: (Constellation | ConstructeurConstellation)[] = [];

  const { hélias } = await créerHéliasTest({
    n,
    dossier: persistante ? dossier : undefined,
  });
  for (const i in [...Array(n).entries()]) {
    const constl = créerConstellation(
      {
        services: {
          dossier: { dossier: path.join(dossier, i) },
          hélia: {
            hélia: hélias[i],
          },
        },
      },
      avecMandataire,
    );
    if (!avecMandataire) await constl.démarrer();
    constls.push(constl);
  }

  await connecterNébuleuses(constls);

  const fermer = async () => {
    await Promise.allSettled(constls.map((c) => c.fermer()));
    effacer();
  };

  return {
    constls,
    fermer,
  };
};

export const créerHéliaÉphémère = <
  L extends ServicesLibp2pNébuleuse = ServicesLibp2pNébuleuse,
>(
  opts?: HeliaInit & { libp2p?: CreateLibp2pOptions<L> },
): HeliaWithLibp2p<L> =>
  withBitswap(
    withLibp2pLight(
      createHeliaLight({
        ...opts,
        codecs: [dagCbor, dagJson, json],
        hashers: [sha512],
      }),
      opts?.libp2p || {},
    ),
  );

export const créerConstellationsLocales: CréerConstellationsTest<
  ServicesLibp2pNébuleuseLocale
> = async ({ n, mode = "dév" }) => {
  const { dossier, effacer } = await dossierTempoPropre();

  const constls: (
    | Constellation<ServicesLibp2pNébuleuseLocale>
    | ConstructeurConstellation<ServicesLibp2pNébuleuseLocale>
  )[] = [];

  for (const i in [...Array(n).entries()]) {
    const constl = créerConstellation<ServicesLibp2pNébuleuseLocale>({
      options: { mode },
      services: {
        dossier: { dossier: path.join(dossier, i) },
        hélia: {
          libp2p: obtenirOptionsLibp2pLocal(),
        },
      },
    });
    constls.push(constl);
  }

  const fermer = async () => {
    await Promise.allSettled(constls.map((c) => c.fermer()));
    effacer();
  };

  return {
    constls,
    fermer,
  };
};

export const utiliserFauxChronomètres = () => {
  const horloge = useFakeTimers({
    shouldAdvanceTime: true,
    now: new Date(),
    shouldClearNativeTimers: true,
  });
  after(() => horloge.reset());
  return horloge;
};

// Tests données
export const vérifierDonnéesTableau = (
  doc: string | WorkBook,
  tableau: string,
  données: ÉlémentDonnéesTableau[],
): void => {
  if (typeof doc === "string") {
    expect(existsSync(doc)).to.be.true();
    doc = xlsxReadFile(doc, {});
  }
  const importateur = new ImportateurFeuilleCalcul(doc);

  const cols = importateur.obtColsTableau(tableau);
  const donnéesFichier = importateur.obtDonnées(tableau, cols);

  expect(donnéesFichier).to.have.deep.members(données);
};

export const vérifierDonnéesBd = (
  doc: string | WorkBook,
  données: { [tableau: string]: ÉlémentDonnéesTableau[] },
): void => {
  if (typeof doc === "string") {
    expect(existsSync(doc));
    doc = xlsxReadFile(doc);
  }
  for (const tableau of Object.keys(données)) {
    vérifierDonnéesTableau(doc, tableau, données[tableau]);
  }
};

export const vérifierDonnéesProjet = async (
  doc: string,
  données: {
    [bd: string]: { [tableau: string]: ÉlémentDonnéesTableau[] };
  },
): Promise<void> => {
  // Il faut essayer plusieurs fois parce que le fichier ZIP peut
  // être créé avant la fin de l'écriture du fichier (ce qui cause
  // une erreur de lecture).

  const zip = await new Promise<JSZip>((compléter) => {
    const interval = setInterval(async () => {
      let zip_: JSZip;
      try {
        const donnéesFichier = readFileSync(doc);
        zip_ = await JSZip.loadAsync(donnéesFichier);
        clearInterval(interval);
        compléter(zip_);
      } catch {
        // Réessayer
      }
    }, 100);
  });

  const { dossier: dossierFichierExtrait, effacer } = await dossierTempo();
  await Promise.allSettled(
    Object.entries(zip.files).map(async ([adresseRelative, élémentZip]) => {
      const adresseAbsolue = path.join(dossierFichierExtrait, adresseRelative);
      if (élémentZip.dir) {
        mkdirSync(adresseAbsolue);
      } else {
        const contenu = await élémentZip.async("nodebuffer");
        writeFileSync(adresseAbsolue, contenu);
      }
    }),
  );

  for (const fichierBd of Object.keys(données)) {
    vérifierDonnéesBd(
      path.join(dossierFichierExtrait, fichierBd),
      données[fichierBd],
    );
  }

  effacer();
};
