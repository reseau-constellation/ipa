import ssim from "ssim";
import correspTexte from "approx-string-match";

import ClientConstellation from "@/client";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  faisRien,
  résultatObjectifRecherche,
  infoRésultatTexte,
} from "@/utils";

export const rechercherDansTexte = (
  schéma: string,
  texte: string
): { score: number; début: number; fin: number } | undefined => {
  // Une alternative - https://www.npmjs.com/package/js-levenshtein
  const correspondances = correspTexte(
    texte,
    schéma,
    Math.ceil(texte.length / 4)
  );
  const meilleure = correspondances.sort((a, b) =>
    a.errors > b.errors ? 1 : -1
  )[0];
  if (meilleure) {
    const score = 1 / (meilleure.errors + 1);
    return { score, début: meilleure.start, fin: meilleure.end };
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
  const similairités = Object.entries(possibilités)
    .map(([clef, val]) => {
      const corresp = rechercherDansTexte(texte, val);
      if (corresp) {
        const { score, début, fin } = corresp;
        return { score, clef, info: { texte, début, fin } };
      }
      return;
    })
    .filter((x) => x);
  const meilleure = similairités.sort((a, b) =>
    a!.score > b!.score ? -1 : 1
  )[0];
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

export const combinerRecherches = async (
  fsRecherche: { [key: string]: schémaFonctionSuivreObjectifRecherche },
  client: ClientConstellation,
  id: string,
  fSuivreRecherche: schémaFonctionSuiviRecherche
): Promise<schémaFonctionOublier> => {
  const fsOublier: schémaFonctionOublier[] = [];

  const résultats: { [key: string]: résultatObjectifRecherche | undefined } =
    Object.fromEntries(Object.keys(fsRecherche).map((x) => [x, undefined]));

  const fSuivreFinale = (): void => {
    const résultat = Object.values(résultats)
      .filter((x) => x)
      .sort((a, b) => (a!.score > b!.score ? -1 : 1))[0];
    fSuivreRecherche(résultat);
  };

  await Promise.all(
    Object.entries(fsRecherche).map(async ([clef, fRecherche]) => {
      const fSuivre = (résultat?: résultatObjectifRecherche) => {
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

export const sousRecherche = async (
  de: string,
  fListe: (
    fSuivreRacine: (ids: string[]) => void
  ) => Promise<schémaFonctionOublier>,
  fRechercher: schémaFonctionSuivreObjectifRecherche,
  client: ClientConstellation,
  fSuivreRecherche: schémaFonctionSuivi<résultatObjectifRecherche>
): Promise<schémaFonctionOublier> => {
  const fBranche = async (
    idBd: string,
    f: (x: { id: string; résultat?: résultatObjectifRecherche }) => void
  ): Promise<schémaFonctionOublier> => {
    return await fRechercher(
      client,
      idBd,
      (résultat?: résultatObjectifRecherche) => f({ id: idBd, résultat })
    );
  };
  const fFinale = (
    résultats: { id: string; résultat: résultatObjectifRecherche }[]
  ) => {
    const meilleur = Object.values(résultats)
      .filter((x) => x)
      .sort((a, b) => (a.résultat.score > b.résultat.score ? -1 : 1))[0];
    fSuivreRecherche(
      Object.assign({ de, clef: meilleur.id }, meilleur.résultat)
    );
  };

  const fOublier = await client.suivreBdsDeFonctionListe(
    fListe,
    fFinale,
    fBranche
  );
  return fOublier;
};

export const rechercherSelonId = (
  idRecherché: string
): schémaFonctionSuivreObjectifRecherche<résultatObjectifRecherche> => {
  return async (
    _client: ClientConstellation,
    id: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const résultat = rechercherDansTexte(idRecherché, id);
    if (résultat) {
      const { score, début, fin } = résultat;
      fSuivreRecherche({
        score,
        de: "id",
        info: {
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

export const rechercherTous = <T extends résultatObjectifRecherche>(): schémaFonctionSuivreObjectifRecherche<T> => {
  return async (
    _client: ClientConstellation,
    _id: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<T>
  ): Promise<schémaFonctionOublier> => {
    fSuivreRecherche({score: 1, de: "*", info: {}});
    return faisRien
  }
}
