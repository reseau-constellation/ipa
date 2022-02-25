import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  schémaFonctionRecherche,
  schémaFonctionSuiviRecherche,
} from "@/utils";

import { rechercherBdSelonTexte } from "./bd";
import { rechercherVariableSelonTexte } from "./variable";
import { rechercherMotClefSelonTexte } from "./motClef";
import {
  similTexte,
  combinerRecherches,
  sousRecherche,
  rechercherSelonId,
} from "./utils";

export const rechercherProjetSelonNom = (
  nomProjet: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomProjet, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.projets!.suivreNomsProjet(idProjet, fSuivre);
    return fOublier;
  };
};

export const rechercherProjetSelonDescr = (
  descProjet: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (descrs: { [key: string]: string }) => {
      const corresp = similTexte(descProjet, descrs);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          score,
          clef,
          info,
          de: "descr",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.projets!.suivreDescrProjet(idProjet, fSuivre);
    return fOublier;
  };
};

export const rechercherProjetSelonIdBd = (
  idBd: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreBdsProjet(idProjet, fSuivreRacine);
    };

    const fRechercher = rechercherSelonId(idBd);

    return await sousRecherche(
      "bd",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonBd = (
  texte: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreBdsProjet(idProjet, fSuivreRacine);
    };

    const fRechercher = rechercherBdSelonTexte(texte);

    return await sousRecherche(
      "bd",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonIdVariable = (
  idVariable: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreVariablesProjet(
        idProjet,
        fSuivreRacine
      );
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

export const rechercherProjetSelonVariable = (
  texte: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreVariablesProjet(
        idProjet,
        fSuivreRacine
      );
    };

    const fRechercher = rechercherVariableSelonTexte(texte);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonIdMotClef = (
  idMotClef: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreMotsClefsProjet(
        idProjet,
        fSuivreRacine
      );
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

export const rechercherProjetSelonMotClef = (
  texte: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreMotsClefsProjet(
        idProjet,
        fSuivreRacine
      );
    };

    const fRechercher = rechercherMotClefSelonTexte(texte);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonTexte = (
  texte: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fRechercherNoms = rechercherProjetSelonNom(texte);
    const fRechercherDescr = rechercherProjetSelonDescr(texte);
    const fRechercherBd = rechercherProjetSelonBd(texte);
    const fRechercherVariable = rechercherProjetSelonVariable(texte);
    const fRechercherMotClef = rechercherProjetSelonMotClef(texte);
    const fRechercherId = rechercherSelonId(texte);

    return await combinerRecherches(
      {
        noms: fRechercherNoms,
        descr: fRechercherDescr,
        bd: fRechercherBd,
        variable: fRechercherVariable,
        motClef: fRechercherMotClef,
        id: fRechercherId,
      },
      client,
      idCompte,
      fSuivreRecherche
    );
  };
};
