import ssim from "ssim";
import correspTexte from "@/_internalisés/approx-string-match";

import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  faisRien,
  résultatObjectifRecherche,
  infoRésultatTexte,
  infoRésultatVide,
  infoRésultatRecherche,
  infoRésultat,
} from "@/utils";

export const rechercherDansTexte = (
  schéma: string,
  texte: string
): { type: "texte"; score: number; début: number; fin: number } | undefined => {
  // Une alternative - https://www.npmjs.com/package/js-levenshtein
  const correspondances = correspTexte(
    texte,
    schéma,
    Math.ceil(schéma.length / 4)
  );
  const meilleure = correspondances.sort((a, b) =>
    a.errors > b.errors ? 1 : -1
  )[0];
  if (meilleure) {
    const score = 1 / (meilleure.errors + 1);
    return { type: "texte", score, début: meilleure.start, fin: meilleure.end };
  }
  return;
};

export const similTexte = (
  texte: string,
  possibilités: { [key: string]: string } | string[]
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
        info: { type: "texte", texte: val, début, fin },
      } as {
        type: "résultat";
        score: number;
        clef: string;
        info: { type: "texte"; texte: string; début: number; fin: number };
      };
    }
    return;
  });

  const meilleure = similairités
    .filter((x) => x)
    .sort((a, b) => (a!.score > b!.score ? -1 : 1))[0];
  return meilleure;
};

export const similImages = (
  image: Uint8Array,
  imageRef: Uint8Array | null
): number => {
  if (!imageRef) {
    return 0;
  }
  const { mssim } = ssim(image, imageRef);
  return mssim;
};

export const combinerRecherches = async <T extends infoRésultat>(
  fsRecherche: { [key: string]: schémaFonctionSuivreObjectifRecherche<T> },
  client: ClientConstellation,
  id: string,
  fSuivreRecherche: schémaFonctionSuiviRecherche<T>
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

  await Promise.all(
    Object.entries(fsRecherche).map(async ([clef, fRecherche]) => {
      const fSuivre = (résultat?: résultatObjectifRecherche<T>) => {
        résultats[clef] = résultat;
        fSuivreFinale();
      };
      fsOublier.push(await fRecherche(client, id, fSuivre));
    })
  );

  return () => {
    fsOublier.forEach((f) => f());
  };
};

export const sousRecherche = async <T extends infoRésultat>(
  de: string,
  fListe: (
    fSuivreRacine: (ids: string[]) => void
  ) => Promise<schémaFonctionOublier>,
  fRechercher: schémaFonctionSuivreObjectifRecherche<T>,
  client: ClientConstellation,
  fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatRecherche<T>>
): Promise<schémaFonctionOublier> => {
  const fBranche = async (
    idBd: string,
    f: (x: { id: string; résultat?: résultatObjectifRecherche<T> }) => void
  ): Promise<schémaFonctionOublier> => {
    return await fRechercher(
      client,
      idBd,
      (résultat?: résultatObjectifRecherche<T>) => f({ id: idBd, résultat })
    );
  };
  const fFinale = (
    résultats: {
      id: string;
      résultat: résultatObjectifRecherche<T>;
    }[]
  ) => {
    const meilleur = meilleurRésultat<T>(résultats);

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
    fSuivreRecherche(résultat);
  };

  const fOublier = await client.suivreBdsDeFonctionListe(
    fListe,
    fFinale,
    fBranche
  );
  return fOublier;
};

const aMieuxQueB = <T extends infoRésultat>(
  a: résultatObjectifRecherche<T>,
  b: résultatObjectifRecherche<T>
): boolean => {
  const xPlusLongQueY = (x: infoRésultat, y: infoRésultat): boolean => {
    while (x.type === "résultat") x = x.info;
    while (y.type === "résultat") x = y.info;

    switch (x.type) {
      case "texte":
        if (y.type === "texte") {
          return x.fin - x.début > y.fin - y.début;
        } else {
          return false;
        }
      default:
        return true;
    }
  };
  return a.score > b.score
    ? true
    : a.score < b.score
    ? false
    : xPlusLongQueY(a.info, b.info)
    ? true
    : false;
};

const meilleurRésultat = <T extends infoRésultat>(
  résultats: { id: string; résultat: résultatObjectifRecherche<T> }[]
): { id: string; résultat: résultatObjectifRecherche<T> } => {
  const meilleur = Object.values(résultats)
    .filter((x) => x)
    .sort((a, b) => (aMieuxQueB(a.résultat, b.résultat) ? -1 : 1))[0];

  return meilleur;
};

export const rechercherSelonId = (
  idRecherché: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    _client: ClientConstellation,
    id: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const résultat = rechercherDansTexte(idRecherché, id);
    if (résultat) {
      const { score, début, fin } = résultat;
      fSuivreRecherche({
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
      fSuivreRecherche();
    }

    return faisRien;
  };
};

export const rechercherTous =
  (): schémaFonctionSuivreObjectifRecherche<infoRésultatVide> => {
    return async (
      _client: ClientConstellation,
      _id: string,
      fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatVide>
    ): Promise<schémaFonctionOublier> => {
      fSuivreRecherche({
        type: "résultat",
        score: 1,
        de: "*",
        info: { type: "vide" },
      });
      return faisRien;
    };
  };
