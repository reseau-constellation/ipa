import { rechercherBdsSelonTexte } from "./bds.js";
import {
  rechercherMotsClefsSelonNom,
  rechercherMotsClefsSelonTexte,
} from "./motsClefs.js";
import {
  similTexte,
  rechercherSelonId,
  sousRecherche,
  rechercherTousSiVide,
  combinerRecherches,
} from "./utils.js";
import {
  rechercherVariablesSelonNom,
  rechercherVariablesSelonTexte,
} from "./variables.js";
import type {
  SuivreObjectifRecherche,
  InfoRésultatTexte,
  SuiviRecherche,
  InfoRésultatRecherche,
  InfoRésultatVide,
} from "../types.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/crabe/types.js";

export const rechercherProjetsSelonNom = (
  nomProjet: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomProjet, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        f({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        f();
      }
    };
    const fOublier = await constl.projets.suivreNoms({
      idProjet: idObjet,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherProjetsSelonDescription = (
  descProjet: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = (descrs: { [key: string]: string }) => {
      const corresp = similTexte(descProjet, descrs);
      if (corresp) {
        const { score, clef, info } = corresp;
        f({
          type: "résultat",
          score,
          clef,
          info,
          de: "descr",
        });
      } else {
        f();
      }
    };
    const fOublier = await constl.projets.suivreDescriptions({
      idProjet: idObjet,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherProjetsSelonIdBd = (
  idBd: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.projets.suivreBds({
        idProjet: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idBd);

    return await sousRecherche("bd", fListe, fRechercher, constl, f);
  };
};

export const rechercherProjetsSelonBd = (
  texte: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<
    | InfoRésultatTexte
    | InfoRésultatRecherche<InfoRésultatTexte>
    | InfoRésultatVide
  >
> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<
      InfoRésultatRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<InfoRésultatTexte>
        | InfoRésultatVide
      >
    >,
 } ): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.projets.suivreBds({
        idProjet: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherBdsSelonTexte(texte);

    return await sousRecherche("bd", fListe, fRechercher, constl, f);
  };
};

export const rechercherProjetsSelonIdVariable = (
  idVariable: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.projets.suivreVariables({
        idProjet: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idVariable);

    return await sousRecherche("variable", fListe, fRechercher, constl, f);
  };
};

export const rechercherProjetsSelonNomVariable = (
  nomVariable: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.projets.suivreVariables({
        idProjet: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariablesSelonNom(nomVariable);

    return await sousRecherche("variable", fListe, fRechercher, constl, f);
  };
};

export const rechercherProjetsSelonVariable = (
  texte: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<
      InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
    >,
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.projets.suivreVariables({
        idProjet: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariablesSelonTexte(texte);

    return await sousRecherche("variable", fListe, fRechercher, constl, f);
  };
};

export const rechercherProjetsSelonIdMotClef = (
  idMotClef: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (motsClefs: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.projets.suivreMotsClefs({
        idProjet: idObjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.idMotClef)),
      });
    };

    const fRechercher = rechercherSelonId(idMotClef);

    return await sousRecherche("motClef", fListe, fRechercher, constl, f);
  };
};

export const rechercherProjetsSelonNomMotClef = (
  nomMotClef: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>,
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (motsClefs: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.projets.suivreMotsClefs({
        idProjet: idObjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.idMotClef)),
      });
    };

    const fRechercher = rechercherMotsClefsSelonNom(nomMotClef);

    return await sousRecherche("motClef", fListe, fRechercher, constl, f);
  };
};

export const rechercherProjetsSelonMotClef = (
  texte: string,
): SuivreObjectifRecherche<
  InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<
      InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
    >,
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (motsClefs: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.projets.suivreMotsClefs({
        idProjet: idObjet,
        f: (motsClefs) => fSuivreRacine(motsClefs.map((m) => m.idMotClef)),
      });
    };

    const fRechercher = rechercherMotsClefsSelonTexte(texte);

    return await sousRecherche("motClef", fListe, fRechercher, constl, f);
  };
};

export const rechercherProjetsSelonTexte = (
  texte: string,
): SuivreObjectifRecherche<
  | InfoRésultatTexte
  | InfoRésultatRecherche<
      | InfoRésultatTexte
      | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
      | InfoRésultatVide
    >
  | InfoRésultatVide
> => {
  return async ({ constl, idObjet, f }: {
    constl: Constellation,
    idObjet: string,
    f: SuiviRecherche<
      | InfoRésultatTexte
      | InfoRésultatRecherche<
          | InfoRésultatTexte
          | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
          | InfoRésultatVide
        >
      | InfoRésultatVide
    >,
  }): Promise<Oublier> => {
    const fRechercherNoms = rechercherProjetsSelonNom(texte);
    const fRechercherDescription = rechercherProjetsSelonDescription(texte);
    const fRechercherBd = rechercherProjetsSelonBd(texte);
    const fRechercherVariable = rechercherProjetsSelonVariable(texte);
    const fRechercherMotClef = rechercherProjetsSelonMotClef(texte);
    const fRechercherId = rechercherSelonId(texte);
    const fRechercherTous = rechercherTousSiVide(texte);

    return await combinerRecherches<
      | InfoRésultatTexte
      | InfoRésultatRecherche<
          | InfoRésultatTexte
          | InfoRésultatVide
          | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
        >
      | InfoRésultatVide
    >(
      {
        noms: fRechercherNoms,
        descr: fRechercherDescription,
        bd: fRechercherBd,
        variable: fRechercherVariable,
        motClef: fRechercherMotClef,
        id: fRechercherId,
        tous: fRechercherTous,
      },
      constl,
      idObjet,
      f,
    );
  };
};
