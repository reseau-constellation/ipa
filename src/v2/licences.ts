import { faisRien } from "@constl/utils-ipa";
import { ServiceAppli } from "./nébuleuse/appli/services.js";
import { cacheSuivi } from "./nébuleuse/cache.js";
import type { OptionsCommunes } from "./nébuleuse/appli/appli.js";
import type { Oublier, Suivi } from "./nébuleuse/types.js";

// Données de https://github.com/github/choosealicense.com
export const conditions = {
  ATTR: "attribution",
  ÉGAL: "partageÉgal",
  INCL: "inclureDroitDauteur",
  CHNG: "indiquerChangements",
  SRCE: "partagerCodeSource",
  USGR: "usagereseau",
} as const;

export const droits = {
  PRTG: "partager",
  ADPT: "adapter",
  CMRC: "usageComercial",
  PRV: "usagePrivé",
  BREV: "usageBrevets",
};

export const limitations = {
  RSP: "aucuneResponsabilité",
  GRNT: "aucuneGarantie",
  MRCM: "marqueCommerce",
  BREV: "brevetExclu",
  SOUS: "sousLicence",
};

export const catégories = {
  BD: "basesDeDonnées",
  ART: "artistique",
  CODE: "codeInformatique",
  AUTRE: "autre",
} as const;

export type InfoLicence = {
  conditions: (typeof conditions)[keyof typeof conditions][];
  droits: (typeof droits)[keyof typeof droits][];
  limitations: (typeof limitations)[keyof typeof limitations][];
  catégorie: (typeof catégories)[keyof typeof catégories];
  spécialisée?: boolean;
};

export type InfoLicenceAvecCode = InfoLicence & {
  code: string;
};

export const infoLicences: { [key: string]: InfoLicence } = {
  // Licences pour BD
  "ODbl-1_0": {
    droits: [droits.CMRC, droits.PRTG, droits.PRV, droits.ADPT],
    conditions: [conditions.ATTR, conditions.ÉGAL, conditions.INCL],
    limitations: [
      limitations.RSP,
      limitations.BREV,
      limitations.MRCM,
      limitations.GRNT,
    ],
    catégorie: catégories.BD,
  },
  "ODC-BY-1_0": {
    droits: [droits.CMRC, droits.PRTG, droits.PRV, droits.ADPT],
    conditions: [conditions.ATTR, conditions.INCL],
    limitations: [
      limitations.RSP,
      limitations.GRNT,
      limitations.MRCM,
      limitations.BREV,
    ],
    catégorie: catégories.BD,
  },
  PDDL: {
    droits: [droits.CMRC, droits.PRTG, droits.ADPT, droits.PRV],
    conditions: [],
    limitations: [
      limitations.RSP,
      limitations.GRNT,
      limitations.MRCM,
      limitations.BREV,
    ],
    catégorie: catégories.BD,
  },
  "rvca-open": {
    droits: [droits.PRV, droits.CMRC, droits.ADPT, droits.PRTG],
    conditions: [conditions.INCL, conditions.ATTR],
    limitations: [limitations.SOUS, limitations.RSP],
    catégorie: catégories.BD,
    spécialisée: true,
  },

  // Licences créatives
  "CC-BY-SA-4_0": {
    droits: [droits.PRTG, droits.ADPT, droits.CMRC, droits.PRV],
    conditions: [conditions.INCL, conditions.CHNG, conditions.ÉGAL],
    limitations: [
      limitations.RSP,
      limitations.MRCM,
      limitations.BREV,
      limitations.GRNT,
    ],
    catégorie: catégories.ART,
  },
  "CC-BY-4_0": {
    droits: [droits.CMRC, droits.PRTG, droits.ADPT, droits.PRV],
    conditions: [conditions.ATTR, conditions.CHNG],
    limitations: [
      limitations.RSP,
      limitations.MRCM,
      limitations.BREV,
      limitations.GRNT,
    ],
    catégorie: catégories.ART,
  },
  "CC-0-1_0": {
    droits: [droits.PRTG, droits.ADPT, droits.CMRC, droits.PRV],
    conditions: [],
    limitations: [
      limitations.RSP,
      limitations.MRCM,
      limitations.BREV,
      limitations.GRNT,
    ],
    catégorie: catégories.ART,
  },

  // Licences code informatique
  "0bsd": {
    droits: [droits.CMRC, droits.PRTG, droits.ADPT, droits.PRV],
    conditions: [],
    limitations: [],
    catégorie: catégories.CODE,
  },
  "afl-3_0": {
    droits: [droits.CMRC, droits.PRTG, droits.ADPT, droits.PRV, droits.BREV],
    conditions: [conditions.INCL, conditions.CHNG],
    limitations: [limitations.MRCM, limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "agpl-3_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [
      conditions.INCL,
      conditions.CHNG,
      conditions.SRCE,
      conditions.USGR,
      conditions.ÉGAL,
    ],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "apache-2_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [conditions.INCL, conditions.CHNG],
    limitations: [limitations.MRCM, limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "artistic-2_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [conditions.INCL, conditions.CHNG],
    limitations: [limitations.RSP, limitations.MRCM, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "bsd-2-clause": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "bsd-3-clause-clear": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.BREV, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "bsd-3-clause": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "bsd-4-clause": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "bsl-1_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "cecill-2_1": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV, droits.BREV],
    conditions: [conditions.INCL, conditions.SRCE, conditions.ÉGAL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "ecl-2_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [conditions.INCL, conditions.CHNG],
    limitations: [limitations.BREV, limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "epl-1_0": {
    droits: [droits.CMRC, droits.PRTG, droits.ADPT, droits.BREV, droits.PRV],
    conditions: [conditions.SRCE, conditions.INCL, conditions.ÉGAL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "epl-2_0": {
    droits: [droits.CMRC, droits.PRTG, droits.ADPT, droits.BREV, droits.PRV],
    conditions: [conditions.SRCE, conditions.INCL, conditions.ÉGAL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "eupl-1_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [
      conditions.INCL,
      conditions.SRCE,
      conditions.CHNG,
      conditions.USGR,
      conditions.ÉGAL,
    ],
    limitations: [limitations.RSP, limitations.MRCM, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "eupl-1_2": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [
      conditions.INCL,
      conditions.SRCE,
      conditions.CHNG,
      conditions.USGR,
      conditions.ÉGAL,
    ],
    limitations: [limitations.RSP, limitations.MRCM, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "gpl-2_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [
      conditions.INCL,
      conditions.CHNG,
      conditions.SRCE,
      conditions.ÉGAL,
    ],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "gpl-3_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRV, droits.BREV, droits.PRV],
    conditions: [
      conditions.INCL,
      conditions.CHNG,
      conditions.SRCE,
      conditions.ÉGAL,
    ],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  isc: {
    droits: [droits.CMRC, droits.PRTG, droits.ADPT, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "lgpl-2_1": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [
      conditions.INCL,
      conditions.SRCE,
      conditions.CHNG,
      conditions.ÉGAL,
    ],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "lgpl-3_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [
      conditions.INCL,
      conditions.SRCE,
      conditions.CHNG,
      conditions.ÉGAL,
    ],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "lppl-1_3c": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [conditions.INCL, conditions.CHNG, conditions.SRCE],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "mit-0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  mit: {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "mpl-2_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [conditions.SRCE, conditions.INCL, conditions.ÉGAL],
    limitations: [limitations.RSP, limitations.MRCM, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "ms-pl": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.GRNT, limitations.MRCM],
    catégorie: catégories.CODE,
  },
  "ms-rl": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [conditions.SRCE, conditions.INCL, conditions.ÉGAL],
    limitations: [limitations.GRNT, limitations.MRCM],
    catégorie: catégories.CODE,
  },
  "mulanpsl-2_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.MRCM, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  ncsa: {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "osl-3_0": {
    droits: [droits.CMRC, droits.PRTG, droits.ADPT, droits.BREV, droits.PRV],
    conditions: [
      conditions.INCL,
      conditions.SRCE,
      conditions.CHNG,
      conditions.USGR,
      conditions.ÉGAL,
    ],
    limitations: [limitations.MRCM, limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  postgresql: {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  unlicence: {
    droits: [droits.PRV, droits.CMRC, droits.ADPT, droits.PRTG],
    conditions: [],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  "upl-1_0": {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.BREV, droits.PRV],
    conditions: [conditions.INCL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },
  vim: {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [
      conditions.INCL,
      conditions.CHNG,
      conditions.SRCE,
      conditions.ÉGAL,
    ],
    limitations: [],
    catégorie: catégories.CODE,
  },
  wtfpl: {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [],
    limitations: [],
    catégorie: catégories.CODE,
  },
  zlib: {
    droits: [droits.CMRC, droits.ADPT, droits.PRTG, droits.PRV],
    conditions: [conditions.INCL, conditions.CHNG],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.CODE,
  },

  // Autres
  "ofl-1_1": {
    droits: [droits.PRV, droits.CMRC, droits.ADPT, droits.PRTG],
    conditions: [conditions.INCL, conditions.ÉGAL],
    limitations: [limitations.RSP, limitations.GRNT],
    catégorie: catégories.AUTRE,
  },
};

export const licences = Object.keys(infoLicences);

export class Licences extends ServiceAppli<"licences"> {
  constructor({ options }: { options: OptionsCommunes }) {
    super({
      clef: "licences",
      services: {},
      options,
    });
  }

  @cacheSuivi
  async suivreLicences({
    f,
  }: {
    f: Suivi<{ [licence: string]: InfoLicence }>;
  }): Promise<Oublier> {
    await f(infoLicences);

    // Pour l'instant. Plus tard, on pourra le connecter avec une nuée
    return faisRien;
  }
}
