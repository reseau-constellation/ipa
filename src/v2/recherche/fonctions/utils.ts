import correspTexte from "approx-string-match";
import ssim from "ssim";

import { faisRien, suivreDeFonctionListe } from "@constl/utils-ipa";
import type { Constellation } from "../../index.js";
import type {
  InfoRésultat,
  InfoRésultatRecherche,
  InfoRésultatTexte,
  InfoRésultatVide,
  RésultatObjectifRecherche,
  SuivreObjectifRecherche,
  SuiviRecherche,
} from "../types.js";
import type { Oublier } from "../../nébuleuse/types.js";
import { ServicesConstellation } from "@/v2/constellation.js";

export const rechercherDansTexte = ({
  schéma,
  texte,
}: {
  schéma: string;
  texte: string;
}):
  | { type: "texte"; score: number; début: number; fin: number }
  | undefined => {
  // Une alternative - https://www.npmjs.com/package/js-levenshtein
  const correspondances = correspTexte(
    texte,
    schéma,
    Math.ceil(schéma.length / 4),
  );
  const meilleure = correspondances.sort((a, b) =>
    a.errors > b.errors ? 1 : -1,
  )[0];
  if (meilleure) {
    const score = 1 / (meilleure.errors + 1);
    return { type: "texte", score, début: meilleure.start, fin: meilleure.end };
  }
  return undefined;
};

export const similTexte = ({
  texte,
  possibilités,
}: {
  texte: string;
  possibilités: { [key: string]: string } | string[];
}): { score: number; clef: string; info: InfoRésultatTexte } | undefined => {
  if (Array.isArray(possibilités)) {
    possibilités = Object.fromEntries(possibilités.map((x) => [x, x]));
  }
  const similairités = Object.entries(possibilités).map(([clef, val]) => {
    const corresp = rechercherDansTexte({ schéma: texte, texte: val });
    if (corresp) {
      const { score, début, fin } = corresp;
      return {
        type: "résultat",
        score,
        clef,
        info: { type: "texte", texte: val, début, fin } as InfoRésultatTexte,
      };
    }
    return undefined;
  });

  const meilleure = similairités
    .filter((x) => x)
    .sort((a, b) => (a!.score > b!.score ? -1 : 1))[0];
  return meilleure;
};

export const similImages = ({
  image,
  imageRéf,
}: {
  image: Uint8Array;
  imageRéf: Uint8Array | null;
}): number => {
  if (!imageRéf) {
    return 0;
  }
  const { mssim } = ssim(image, imageRéf);
  return mssim;
};

export const combinerRecherches = async <T extends InfoRésultat>({
  fsRecherche,
    services,
      idObjet,
  fSuivreRecherche,
}: {
  fsRecherche: { [key: string]: SuivreObjectifRecherche<T> };
services: ServicesConstellation;
  idObjet: string;
  fSuivreRecherche: SuiviRecherche<T>;
}): Promise<Oublier> => {
  const fsOublier: Oublier[] = [];

  const résultats: { [key: string]: RésultatObjectifRecherche<T> | undefined } =
    Object.fromEntries(Object.keys(fsRecherche).map((x) => [x, undefined]));

  const fSuivreFinale = (): void => {
    const résultat = Object.values(résultats)
      .filter((x) => x)
      .sort((a, b) => (aMieuxQueB(a!, b!) ? -1 : 1))[0];
    fSuivreRecherche(résultat);
  };

  await Promise.allSettled(
    Object.entries(fsRecherche).map(async ([clef, fRecherche]) => {
      const fSuivre = async (résultat?: RésultatObjectifRecherche<T>) => {
        résultats[clef] = résultat;
        fSuivreFinale();
      };
      fsOublier.push(await fRecherche({ services, idObjet, f: fSuivre }));
    }),
  );

  return async () => {
    await Promise.allSettled(fsOublier.map((f) => f()));
  };
};

export const sousRecherche = async <T extends InfoRésultat>({
  de,
  fListe,
  fRechercher,
  services,
  fSuivreRecherche,
}: {
  de: string;
  fListe: ({
    fSuivreRacine,
  }: {
    fSuivreRacine: (ids: string[]) => void;
  }) => Promise<Oublier>;
  fRechercher: SuivreObjectifRecherche<T>;
  services: ServicesConstellation;
  fSuivreRecherche: SuiviRecherche<InfoRésultatRecherche<T>>;
}): Promise<Oublier> => {
  const fBranche = async ({
    id: idObjet,
    fSuivreBranche,
  }: {
    id: string;
    fSuivreBranche: (x: {
      idObjet: string;
      résultat: RésultatObjectifRecherche<T>;
    }) => void;
  }): Promise<Oublier> => {
    return await fRechercher({
      services,
      idObjet,
      f: async (résultat?: RésultatObjectifRecherche<T>) => {
        if (résultat) fSuivreBranche({ idObjet, résultat });
      },
    });
  };
  const fFinale = async (
    résultats: {
      idObjet: string;
      résultat: RésultatObjectifRecherche<T>;
    }[],
  ) => {
    const meilleur = meilleurRésultat<T>(résultats);

    if (meilleur) {
      const résultat: RésultatObjectifRecherche<InfoRésultatRecherche<T>> = {
        type: "résultat",
        de,
        clef: meilleur.idObjet,
        score: meilleur.résultat.score,
        info: {
          type: "résultat",
          de: meilleur.résultat.de,
          info: meilleur.résultat.info,
        },
      };
      if (meilleur.résultat.clef) {
        résultat.info.clef = meilleur.résultat.clef;
      }
      await fSuivreRecherche(résultat);
    }
  };

  const oublier = await suivreDeFonctionListe({
    fListe,
    f: fFinale,
    fBranche,
  });
  return oublier;
};

const aMieuxQueB = <T extends InfoRésultat>(
  a: RésultatObjectifRecherche<T>,
  b: RésultatObjectifRecherche<T>,
): boolean => {
  const xPlusImportantQueY = (x: InfoRésultat, y: InfoRésultat): boolean => {
    while (x.type === "résultat") x = x.info;
    while (y.type === "résultat") y = y.info;

    const ordreImportanceCroissante: InfoRésultat["type"][] = ["vide", "texte"];
    const iX = ordreImportanceCroissante.indexOf(x.type);
    const iY = ordreImportanceCroissante.indexOf(y.type);

    return iX > iY;
  };
  const xPlusLongQueY = (x: InfoRésultat, y: InfoRésultat): boolean => {
    while (x.type === "résultat") x = x.info;
    while (y.type === "résultat") y = y.info;

    switch (x.type) {
      case "texte":
        if (y.type === "texte") {
          return x.fin - x.début > y.fin - y.début;
        } else {
          return false;
        }
      default:
        return false;
    }
  };

  return a.score > b.score
    ? true
    : a.score < b.score
      ? false
      : xPlusLongQueY(a.info, b.info)
        ? true
        : xPlusImportantQueY(a.info, b.info);
};

const meilleurRésultat = <T extends InfoRésultat>(
  résultats: { idObjet: string; résultat: RésultatObjectifRecherche<T> }[],
): { idObjet: string; résultat: RésultatObjectifRecherche<T> } | undefined => {
  const meilleur = Object.values(résultats)
    .filter((x) => x)
    .sort((a, b) => (aMieuxQueB(a.résultat, b.résultat) ? -1 : 1))[0];
  return meilleur;
};

export const rechercherSelonId = (
  idRecherché: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const résultat = rechercherDansTexte({
      schéma: idRecherché,
      texte: idObjet,
    });
    if (résultat) {
      const { score, début, fin } = résultat;
      await f({
        score,
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début,
          fin,
          texte: idObjet,
        },
      });
    } else {
      await f();
    }

    return faisRien;
  };
};

export const rechercherTous = (): SuivreObjectifRecherche<InfoRésultatVide> => {
  return async ({ f }): Promise<Oublier> => {
    await f({
      type: "résultat",
      score: 1,
      de: "*",
      info: { type: "vide" },
    });
    return faisRien;
  };
};

export const rechercherTousSiVide = (
  texte: string,
): SuivreObjectifRecherche<InfoRésultatVide> => {
  return async ({ f }): Promise<Oublier> => {
    if (texte === "")
      await f({
        type: "résultat",
        score: 1,
        de: "*",
        info: { type: "vide" },
      });
    return faisRien;
  };
};
