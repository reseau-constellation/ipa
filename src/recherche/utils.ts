import correspTexte from "approx-string-match";
import ssim from "ssim";

import { faisRien, suivreDeFonctionListe } from "@constl/utils-ipa";
import type { Constellation } from "@/client.js";
import type {
  infoRésultat,
  infoRésultatRecherche,
  infoRésultatTexte,
  infoRésultatVide,
  résultatObjectifRecherche,
  schémaFonctionOublier,
  schémaFonctionSuiviRecherche,
  schémaFonctionSuivreObjectifRecherche,
} from "@/types.js";

export const rechercherDansTexte = (
  schéma: string,
  texte: string,
): { type: "texte"; score: number; début: number; fin: number } | undefined => {
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

export const similTexte = (
  texte: string,
  possibilités: { [key: string]: string } | string[],
): { score: number; clef: string; info: infoRésultatTexte } | undefined => {
  if (Array.isArray(possibilités)) {
    possibilités = Object.fromEntries(possibilités.map((x) => [x, x]));
  }
  const similairités = Object.entries(possibilités).map(([clef, val]) => {
    const corresp = rechercherDansTexte(texte, val);
    if (corresp) {
      const { score, début, fin } = corresp;
      return {
        type: "résultat",
        score,
        clef,
        info: { type: "texte", texte: val, début, fin } as infoRésultatTexte,
      };
    }
    return undefined;
  });

  const meilleure = similairités
    .filter((x) => x)
    .sort((a, b) => (a!.score > b!.score ? -1 : 1))[0];
  return meilleure;
};

export const similImages = (
  image: Uint8Array,
  imageRef: Uint8Array | null,
): number => {
  if (!imageRef) {
    return 0;
  }
  const { mssim } = ssim(image, imageRef);
  return mssim;
};

export const combinerRecherches = async <T extends infoRésultat>(
  fsRecherche: { [key: string]: schémaFonctionSuivreObjectifRecherche<T> },
  client: Constellation,
  id: string,
  fSuivreRecherche: schémaFonctionSuiviRecherche<T>,
): Promise<schémaFonctionOublier> => {
  const fsOublier: schémaFonctionOublier[] = [];

  const résultats: { [key: string]: résultatObjectifRecherche<T> | undefined } =
    Object.fromEntries(Object.keys(fsRecherche).map((x) => [x, undefined]));

  const fSuivreFinale = (): void => {
    const résultat = Object.values(résultats)
      .filter((x) => x)
      .sort((a, b) => (aMieuxQueB(a!, b!) ? -1 : 1))[0];
    fSuivreRecherche(résultat);
  };

  await Promise.allSettled(
    Object.entries(fsRecherche).map(async ([clef, fRecherche]) => {
      const fSuivre = async (résultat?: résultatObjectifRecherche<T>) => {
        résultats[clef] = résultat;
        fSuivreFinale();
      };
      fsOublier.push(await fRecherche(client, id, fSuivre));
    }),
  );

  return async () => {
    await Promise.allSettled(fsOublier.map((f) => f()));
  };
};

export const sousRecherche = async <T extends infoRésultat>(
  de: string,
  fListe: ({
    fSuivreRacine,
  }: {
    fSuivreRacine: (ids: string[]) => void;
  }) => Promise<schémaFonctionOublier>,
  fRechercher: schémaFonctionSuivreObjectifRecherche<T>,
  client: Constellation,
  fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatRecherche<T>>,
): Promise<schémaFonctionOublier> => {
  const fBranche = async ({
    id: idBd,
    fSuivreBranche,
  }: {
    id: string;
    fSuivreBranche: (x: {
      id: string;
      résultat: résultatObjectifRecherche<T>;
    }) => void;
  }): Promise<schémaFonctionOublier> => {
    return await fRechercher(
      client,
      idBd,
      async (résultat?: résultatObjectifRecherche<T>) => {
        if (résultat) fSuivreBranche({ id: idBd, résultat });
      },
    );
  };
  const fFinale = async (
    résultats: {
      id: string;
      résultat: résultatObjectifRecherche<T>;
    }[],
  ) => {
    const meilleur = meilleurRésultat<T>(résultats);

    if (meilleur) {
      const résultat: résultatObjectifRecherche<infoRésultatRecherche<T>> = {
        type: "résultat",
        de,
        clef: meilleur.id,
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

  const fOublier = await suivreDeFonctionListe({
    fListe,
    f: fFinale,
    fBranche,
  });
  return fOublier;
};

const aMieuxQueB = <T extends infoRésultat>(
  a: résultatObjectifRecherche<T>,
  b: résultatObjectifRecherche<T>,
): boolean => {
  const xPlusImportantQueY = (x: infoRésultat, y: infoRésultat): boolean => {
    while (x.type === "résultat") x = x.info;
    while (y.type === "résultat") y = y.info;

    const ordreImportanceCroissante: infoRésultat["type"][] = ["vide", "texte"];
    const iX = ordreImportanceCroissante.indexOf(x.type);
    const iY = ordreImportanceCroissante.indexOf(y.type);

    return iX > iY;
  };
  const xPlusLongQueY = (x: infoRésultat, y: infoRésultat): boolean => {
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

const meilleurRésultat = <T extends infoRésultat>(
  résultats: { id: string; résultat: résultatObjectifRecherche<T> }[],
): { id: string; résultat: résultatObjectifRecherche<T> } | undefined => {
  const meilleur = Object.values(résultats)
    .filter((x) => x)
    .sort((a, b) => (aMieuxQueB(a.résultat, b.résultat) ? -1 : 1))[0];
  return meilleur;
};

export const rechercherSelonId = (
  idRecherché: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    _client: Constellation,
    id: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const résultat = rechercherDansTexte(idRecherché, id);
    if (résultat) {
      const { score, début, fin } = résultat;
      await fSuivreRecherche({
        score,
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début,
          fin,
          texte: id,
        },
      });
    } else {
      await fSuivreRecherche();
    }

    return faisRien;
  };
};

export const rechercherTous =
  (): schémaFonctionSuivreObjectifRecherche<infoRésultatVide> => {
    return async (
      _client: Constellation,
      _id: string,
      fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatVide>,
    ): Promise<schémaFonctionOublier> => {
      await fSuivreRecherche({
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
): schémaFonctionSuivreObjectifRecherche<infoRésultatVide> => {
  return async (
    _client: Constellation,
    _id: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatVide>,
  ): Promise<schémaFonctionOublier> => {
    if (texte === "")
      await fSuivreRecherche({
        type: "résultat",
        score: 1,
        de: "*",
        info: { type: "vide" },
      });
    return faisRien;
  };
};
