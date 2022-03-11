import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  infoRésultatTexte,
  infoRésultatRecherche,
} from "@/utils";

import { rechercherVariableSelonNom } from "./variable";
import { rechercherMotClefSelonNom } from "./motClef";
import {
  combinerRecherches,
  sousRecherche,
  rechercherSelonId,
  similTexte,
} from "./utils";

export const rechercherBdSelonNom = (
  nomBd: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {

  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomBd, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.bds!.suivreNomsBd(idBd, fSuivre);
    return fOublier;
  };

};

export const rechercherBdSelonDescr = (
  descrBd: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (descrs: { [key: string]: string }) => {
      const corresp = similTexte(descrBd, descrs);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "descr",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.bds!.suivreDescrBd(idBd, fSuivre);
    return fOublier;
  };
};

export const rechercherBdSelonIdVariable = (
  idVariable: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatRecherche<infoRésultatTexte>>
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.bds!.suivreVariablesBd(idBd, fSuivreRacine);
    };

    const fRechercher = rechercherSelonId(idVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherBdSelonNomVariable = (
  nomVariable: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatRecherche<infoRésultatTexte>>
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.bds!.suivreVariablesBd(idBd, fSuivreRacine);
    };

    const fRechercher = rechercherVariableSelonNom(nomVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherBdSelonVariable = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatRecherche<infoRésultatTexte>>
  ) => {
    return await combinerRecherches(
      {
        id: rechercherBdSelonIdVariable(texte),
        nom: rechercherBdSelonNomVariable(texte),
      },
      client,
      idBd,
      fSuivreRecherche
    );
  };
};

export const rechercherBdSelonIdMotClef = (
  idMotClef: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatRecherche<infoRésultatTexte>>
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.bds!.suivreMotsClefsBd(idBd, fSuivreRacine);
    };

    const fRechercher = rechercherSelonId(idMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherBdSelonNomMotClef = (
  nomMotClef: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatRecherche<infoRésultatTexte>>
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.bds!.suivreMotsClefsBd(idBd, fSuivreRacine);
    };

    const fRechercher = rechercherMotClefSelonNom(nomMotClef);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherBdSelonMotClef = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>> => {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatRecherche<infoRésultatTexte>>
  ) => {
    return await combinerRecherches(
      {
        id: rechercherBdSelonIdMotClef(texte),
        nom: rechercherBdSelonNomMotClef(texte),
      },
      client,
      idBd,
      fSuivreRecherche
    );
  };
};

export const rechercherBdSelonTexte = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte>=> {
  return async (
    client: ClientConstellation,
    idBd: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte>
  ) => {
    return await combinerRecherches<infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte>(
      {
        nom: rechercherBdSelonNom(texte),
        descr: rechercherBdSelonDescr(texte),
        variables: rechercherBdSelonVariable(texte),
        motsClefs: rechercherBdSelonMotClef(texte),
        id: rechercherSelonId(texte),
      },
      client,
      idBd,
      fSuivreRecherche
    );
  };
};
