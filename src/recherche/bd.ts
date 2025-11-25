import { ignorerNonDéfinis } from "@constl/utils-ipa";
import { rechercherMotsClefsSelonNom } from "@/recherche/motClef.js";
import {
  combinerRecherches,
  rechercherSelonId,
  rechercherTousSiVide,
  similTexte,
  sousRecherche,
} from "@/v2/recherche/utils.js";
import { rechercherVariablesSelonNom } from "@/recherche/variable.js";

import type { Oublier } from "@/v2/crabe/types.js";
import type { Constellation } from "@/v2/index.js";
import type {
  InfoRésultatRecherche,
  InfoRésultatTexte,
  InfoRésultatVide,
  RechercherSelonObjectif,
  SuiviRecherche,
} from "@/v2/recherche/types.js";
import type { TraducsTexte } from "@/v2/types.js";

export const rechercherBdsSelonNom = (
  nomBd: string,
): RechercherSelonObjectif<InfoRésultatTexte> => {
  return async ({
    client,
    idBd,
    f,
  }: {
    client: Constellation;
    idBd: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = async (noms: TraducsTexte) => {
      const corresp = similTexte(nomBd, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        return await fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        return await fSuivreRecherche();
      }
    };
    const fOublier = await client.bds.suivreNoms({
      idBd,
      f: ignorerNonDéfinis(fSuivre),
    });
    return fOublier;
  };
};

export const rechercherBdsSelonDescr = (
  descrBd: string,
): RechercherSelonObjectif<InfoRésultatTexte> => {
  return async (
    client: Constellation,
    idBd: string,
    fSuivreRecherche: SuiviRecherche<InfoRésultatTexte>,
  ): Promise<Oublier> => {
    const fSuivre = async (descrs: { [key: string]: string }) => {
      const corresp = similTexte(descrBd, descrs);
      if (corresp) {
        const { score, clef, info } = corresp;
        return await fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "descr",
        });
      } else {
        return await fSuivreRecherche();
      }
    };
    const fOublier = await client.bds.suivreDescriptions({
      idBd,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherBdsSelonIdVariable = (
  idVariable: string,
): RechercherSelonObjectif<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async (
    client: Constellation,
    idBd: string,
    fSuivreRecherche: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  ): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await client.bds.suivreVariablesBd({
        idBd,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonNomVariable = (
  nomVariable: string,
): RechercherSelonObjectif<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async (
    client: Constellation,
    idBd: string,
    fSuivreRecherche: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  ): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await client.bds.suivreVariablesBd({
        idBd,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariablesSelonNom(nomVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonVariable = (
  texte: string,
): RechercherSelonObjectif<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async (
    client: Constellation,
    idBd: string,
    fSuivreRecherche: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  ) => {
    return await combinerRecherches(
      {
        id: rechercherBdsSelonIdVariable(texte),
        nom: rechercherBdsSelonNomVariable(texte),
      },
      client,
      idBd,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonIdMotClef = (
  idMotClef: string,
): RechercherSelonObjectif<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async (
    client: Constellation,
    idBd: string,
    fSuivreRecherche: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  ): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await client.bds.suivreMotsClefsBd({
        idBd,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonNomMotClef = (
  nomMotClef: string,
): RechercherSelonObjectif<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async (
    client: Constellation,
    idBd: string,
    fSuivreRecherche: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  ): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await client.bds.suivreMotsClefsBd({
        idBd,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherMotsClefsSelonNom(nomMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonMotClef = (
  texte: string,
): RechercherSelonObjectif<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async (
    client: Constellation,
    idBd: string,
    fSuivreRecherche: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  ) => {
    return await combinerRecherches(
      {
        id: rechercherBdsSelonIdMotClef(texte),
        nom: rechercherBdsSelonNomMotClef(texte),
      },
      client,
      idBd,
      fSuivreRecherche,
    );
  };
};

export const rechercherBdsSelonTexte = (
  texte: string,
): RechercherSelonObjectif<
  | InfoRésultatRecherche<InfoRésultatTexte>
  | InfoRésultatTexte
  | InfoRésultatVide
> => {
  return async (
    client: Constellation,
    idBd: string,
    fSuivreRecherche: SuiviRecherche<
      | InfoRésultatRecherche<InfoRésultatTexte>
      | InfoRésultatTexte
      | InfoRésultatVide
    >,
  ) => {
    return await combinerRecherches<
      | InfoRésultatRecherche<InfoRésultatTexte>
      | InfoRésultatTexte
      | InfoRésultatVide
    >(
      {
        nom: rechercherBdsSelonNom(texte),
        descr: rechercherBdsSelonDescr(texte),
        variables: rechercherBdsSelonVariable(texte),
        motsClefs: rechercherBdsSelonMotClef(texte),
        id: rechercherSelonId(texte),
        vide: rechercherTousSiVide(texte),
      },
      client,
      idBd,
      fSuivreRecherche,
    );
  };
};
