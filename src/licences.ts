import { faisRien } from "@constl/utils-ipa";
import {
  கிளி,
  type அங்கீகரிக்கப்பட்ட_உறுப்படி_வகை,
  type பிணையம்_பரிந்துரை,
} from "@lassi-js/kili";

import { TypedEmitter } from "tiny-typed-emitter";
import { Constellation } from "@/client.js";
import {
  CLEF_TABLEAU_LICENCES_APPROUVÉES,
  ID_NUÉE_LICENCES,
  SCHÉMA_BD_LICENCES,
} from "@/const.js";
import { cacheSuivi } from "@/décorateursCache.js";
import { mandatairifier } from "./mandataire/index.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaRetourFonctionRechercheParProfondeur,
} from "@/types";

// https://github.com/github/choosealicense.com
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

type ÉvénementsLicences = {
  prêt: (args: { perroquet?: கிளி<InfoLicenceAvecCode> | false }) => void;
};

export class Licences {
  client: Constellation;
  événements: TypedEmitter<ÉvénementsLicences>;
  perroquet?: கிளி<InfoLicenceAvecCode> | false;

  constructor({ client }: { client: Constellation }) {
    this.client = client;

    this.événements = new TypedEmitter<ÉvénementsLicences>();
    this.initialiser();
  }

  async initialiser() {
    if (
      SCHÉMA_BD_LICENCES &&
      CLEF_TABLEAU_LICENCES_APPROUVÉES &&
      ID_NUÉE_LICENCES
    ) {
      const perroquet = new கிளி({
        // À faire: arranger types
        விண்மீன்: mandatairifier(
          this.client,
        ) as unknown as ConstructorParameters<
          typeof கிளி<InfoLicenceAvecCode>
        >[0]["விண்மீன்"],
        அட்டவணை_சாபி: CLEF_TABLEAU_LICENCES_APPROUVÉES,
        குழு_அடையாளம்: ID_NUÉE_LICENCES,
        வார்ப்புரு: SCHÉMA_BD_LICENCES,
      });
      this.perroquet = perroquet;
    } else {
      this.perroquet = false;
    }
    this.événements.emit("prêt", { perroquet: this.perroquet });
  }

  async obtPerroquet(): Promise<{
    perroquet: கிளி<InfoLicenceAvecCode> | false;
  }> {
    if (this.perroquet !== undefined) return { perroquet: this.perroquet };
    return new Promise((résoudre, rejeter) => {
      this.événements.once("prêt", ({ perroquet }) => {
        if (perroquet) résoudre({ perroquet });
        // À faire: Enlever lorsque configuré.
        rejeter("Configuration licences non initialisée.");
      });
    });
  }

  @cacheSuivi
  async suivreLicences({
    f,
  }: {
    f: schémaFonctionSuivi<{ [licence: string]: InfoLicence }>;
  }): Promise<schémaFonctionOublier> {
    await f(infoLicences);

    const { perroquet } = await this.obtPerroquet(); // À faire: Enlever lorsque configuré.
    if (perroquet) {
      const fFinale = async (
        licences: அங்கீகரிக்கப்பட்ட_உறுப்படி_வகை<InfoLicenceAvecCode>[],
      ) => {
        return await f(Object.fromEntries(licences.map((l) => [l.code, l])));
      };
      return await perroquet.உறுப்படிகளை_கேள்ளு({
        செ: fFinale,
        பரிந்துரைகள்: "எனது",
      });
    }

    // Pour l'instant. Plus tard, on pourra le connecter avec une nuée Kili
    return faisRien;
  }

  async suggérerLicence({
    code,
    infoLicence,
  }: {
    code: string;
    infoLicence: InfoLicence;
  }): Promise<void> {
    const { perroquet } = await this.obtPerroquet(); // À faire: Enlever lorsque configuré.
    if (perroquet) {
      await perroquet.பரிந்துரையு({
        பரிந்துரை: {
          code,
          ...infoLicence,
        },
      });
    }
  }

  async effacerSuggestionLicence({
    idÉlément,
  }: {
    idÉlément: string;
  }): Promise<void> {
    const { perroquet } = await this.obtPerroquet(); // À faire: Enlever lorsque configuré.
    if (perroquet) {
      await perroquet.பரிந்துரையை_நீக்கு({ அடையாளம்: idÉlément });
    }
  }

  async suivreSuggestionsLicences({
    f,
  }: {
    f: schémaFonctionSuivi<பிணையம்_பரிந்துரை<InfoLicenceAvecCode>[]>;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    const { perroquet } = await this.obtPerroquet(); // À faire: Enlever lorsque configuré.
    if (perroquet) {
      return await perroquet.பரிந்துரைகளை_கேள்ளு({ செ: f });
    }
    return { fOublier: faisRien, fChangerProfondeur: faisRien };
  }

  async approuverLicence({
    suggestion,
  }: {
    suggestion: பிணையம்_பரிந்துரை<InfoLicenceAvecCode>;
  }): Promise<void> {
    const { perroquet } = await this.obtPerroquet(); // À faire: Enlever lorsque configuré.
    if (perroquet) {
      await perroquet.அங்கீகரி({ பரிந்துரை: suggestion });
    }
  }
}
