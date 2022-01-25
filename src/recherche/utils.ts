import levenshtein from "js-levenshtein";

import ClientConstellation from "@/client";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaFonctionRecherche
} from "@/utils"

export const levenshtein01 = (texte1: string, texte2: string): number => {
  // Une alternative - https://www.npmjs.com/package/approx-string-match
  const simil = levenshtein(texte1, texte2)
  const score =  1 / (simil + 1)
  return score
}

export const maxLevenshtein01 = (texteCible: string, possibilités: string[]): number => {
  return Math.max.apply(null, possibilités.map(x=>levenshtein01(x, texteCible)))
}

export const combinerRecherches = async (
  fsRecherche: { [key: string]: schémaFonctionRecherche },
  client: ClientConstellation,
  id: string,
  fSuivreRecherche: schémaFonctionSuivi<number>,
): Promise<schémaFonctionOublier> => {

  const fsOublier: schémaFonctionOublier[] = []

  const scores = Object.fromEntries(Object.keys(fsRecherche).map(x=>[x, 0]))

  const fSuivreFinale = (): void => {
    const scoreFinal = Math.max.apply(Object.values(scores));
    fSuivreRecherche(scoreFinal);
  }

  await Promise.all(Object.entries(fsRecherche).map(
    async ( [clef, fRecherche] ) => {
      const fSuivre = (score: number) => {
        scores[clef] = score;
        fSuivreFinale();
      }
      fsOublier.push(
        await fRecherche(client, id, fSuivre)
      );
    }
  ))

  return () => {
    fsOublier.forEach(f=>f());
  }
}
