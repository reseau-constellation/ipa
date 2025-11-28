import { typedNested } from "@constl/bohr-db";
import { toObject } from "@orbitdb/nested-db";
import { faisRien, suivreDeFonctionListe } from "@constl/utils-ipa";
import { cacheSuivi } from "./crabe/cache.js";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { mapÀObjet } from "./crabe/utils.js";
import { TOUS_DISPOSITIFS, résoudreDéfauts } from "./favoris.js";
import { schémaTraducsTexte } from "./schémas.js";
import { ajouterProtocoleOrbite, extraireEmpreinte } from "./utils.js";
import { RechercheMotsClefs } from "./recherche/motsClefs.js";
import type {
  Rôle,
  AccèsUtilisateur,
} from "./crabe/services/compte/accès/types.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type {
  BaseÉpingleFavoris,
  ÉpingleFavorisBooléenniséeAvecId,
} from "./favoris.js";
import type { InfoAuteur, PartielRécursif, TraducsTexte } from "./types.js";
import type { Oublier, Suivi } from "./crabe/types.js";
import type { Constellation, ServicesConstellation } from "./constellation.js";
import type { JSONSchemaType } from "ajv";
import type { TypedNested } from "@constl/bohr-db";

// Types structure

export type StructureMotClef = {
  type: "mot-clef";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
};

export type StructureServiceMotsClefs = {
  [motClef: string]: null;
};

export const schémaServiceMotsClefs: JSONSchemaType<
  PartielRécursif<StructureServiceMotsClefs>
> = {
  type: "object",
  additionalProperties: true,
  required: [],
};

export const schémaMotClef: JSONSchemaType<PartielRécursif<StructureMotClef>> =
  {
    type: "object",
    properties: {
      type: { type: "string", nullable: true },
      noms: schémaTraducsTexte,
      descriptions: schémaTraducsTexte,
    },
    required: [],
  };

// Types épingles

export type ÉpingleMotClef = {
  type: "mot-clef",
  épingle: ContenuÉpingleMotClef
};

export type ContenuÉpingleMotClef = BaseÉpingleFavoris

export class MotsClefs<
  L extends ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<
  "motsClefs",
  StructureServiceMotsClefs,
  L,
  ServicesConstellation
> {
  recherche: RechercheMotsClefs<L>;

  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "motsClefs",
      nébuleuse,
      dépendances: ["favoris", "réseau", "compte", "orbite"],
      options: {
        schéma: schémaServiceMotsClefs,
      },
    });

    this.recherche = new RechercheMotsClefs<L>({
      motsClefs: this,
      constl: this.nébuleuse,
      service: (clef) => this.service(clef),
    });

    const favoris = this.service("favoris");
    favoris.inscrireRésolution({
      clef: "mot-clef",
      résolution: this.suivreRésolutionÉpingle.bind(this),
    });
  }

  @cacheSuivi
  async suivreMotsClefs({
    f,
    idCompte,
  }: {
    f: Suivi<string[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) =>
        await this.suivreBd({
          idCompte,
          f: async (motsClefs) =>
            await fSuivreRacine(
              motsClefs
                ? Object.keys(motsClefs).map(ajouterProtocoleOrbite)
                : [],
            ),
        }),
      fBranche: async ({ id: idObjet, fSuivreBranche }) => {
        return await compte.suivrePermission({
          idObjet,
          idCompte,
          f: async (permission) =>
            await fSuivreBranche(permission ? idObjet : undefined),
        });
      },
      f,
    });
  }

  async créerMotClef({
    épingler = true,
  }: { épingler?: boolean } = {}): Promise<string> {
    const compte = this.service("compte");
    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
    });
    const idMotClef = bd.address;
    await oublierBd();
    const { motClef, oublier } = await this.ouvrirMotClef({ idMotClef });

    await this.ajouterÀMesMotsClefs({ idMotClef });

    if (épingler) await this.épingler({ idMotClef });

    await motClef.put("type", "mot-clef");

    await oublier();
    return idMotClef;
  }

  async copierMotClef({ idMotClef }: { idMotClef: string }): Promise<string> {
    const { motClef, oublier } = await this.ouvrirMotClef({ idMotClef });
    const idNouveauMotClef = await this.créerMotClef();

    const noms = mapÀObjet(await motClef.get("noms"));
    if (noms) await this.sauvegarderNoms({ idMotClef: idNouveauMotClef, noms });

    const descriptions = mapÀObjet(await motClef.get("descriptions"));
    if (descriptions)
      await this.sauvegarderDescriptions({
        idMotClef: idNouveauMotClef,
        descriptions,
      });

    await oublier();
    return idNouveauMotClef;
  }

  async effacerMotClef({ idMotClef }: { idMotClef: string }): Promise<void> {
    // Effacer l'entrée dans notre liste de mots-clefs
    await this.enleverDeMesMotsClefs({ idMotClef });

    const favoris = this.service("favoris");
    await favoris.désépinglerFavori({ idObjet: idMotClef });

    // Effacer le mot-clef lui-même
    await this.service("orbite").effacerBd({ id: idMotClef });
  }

  async ajouterÀMesMotsClefs({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const bd = await this.bd();
    await bd.put(extraireEmpreinte(idMotClef), null);
  }

  async enleverDeMesMotsClefs({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const bd = await this.bd();
    await bd.del(extraireEmpreinte(idMotClef));
  }

  async ouvrirMotClef({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<{ motClef: TypedNested<StructureMotClef>; oublier: Oublier }> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idMotClef,
      type: "nested",
    });
    return {
      motClef: typedNested<StructureMotClef>({ db: bd, schema: schémaMotClef }),
      oublier,
    };
  }

  // Accèss

  async inviterAuteur({
    idMotClef,
    idCompte,
    rôle,
  }: {
    idMotClef: string;
    idCompte: string;
    rôle: Rôle;
  }): Promise<void> {
    const compte = this.service("compte");

    return await compte.donnerAccèsObjet({
      idObjet: idMotClef,
      identité: idCompte,
      rôle,
    });
  }

  async suivreAuteurs({
    idMotClef,
    f,
  }: {
    idMotClef: string;
    f: Suivi<InfoAuteur[]>;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    return await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: Suivi<AccèsUtilisateur[]>;
      }) =>
        await compte.suivreAutorisations({
          idObjet: idMotClef,
          f: fSuivreRacine,
        }),
      fBranche: async ({
        id: idCompte,
        fSuivreBranche,
        branche,
      }: {
        id: string;
        fSuivreBranche: Suivi<InfoAuteur>;
        branche: AccèsUtilisateur;
      }) => {
        // On doit appeler ça ici pour avancer même si l'autre compte n'est pas disponible.
        await fSuivreBranche({
          idCompte,
          accepté: false,
          rôle: branche.rôle,
        });
        return await this.suivreMotsClefs({
          idCompte,
          f: async (motsClefsCompte) => {
            return await fSuivreBranche({
              idCompte,
              accepté: (motsClefsCompte || []).includes(idMotClef),
              rôle: branche.rôle,
            });
          },
        });
      },
      fIdDeBranche: (x) => x.idCompte,
      f,
    });
  }

  async confirmerPermission({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: idMotClef })))
      throw new Error(
        `Permission de modification refusée pour le mot-clef ${idMotClef}.`,
      );
  }

  // Épingler

  async épingler({
    idMotClef,
    options = {},
  }: {
    idMotClef: string;
    options?: PartielRécursif<ContenuÉpingleMotClef>;
  }) {
    const épingle: ContenuÉpingleMotClef = résoudreDéfauts(options, {
      base: TOUS_DISPOSITIFS,
    });

    const favoris = this.service("favoris");
    await favoris.épinglerFavori({ idObjet: idMotClef, épingle: { type: "mot-clef", épingle } });
  }

  async suivreÉpingle({
    idMotClef,
    f,
    idCompte,
  }: {
    idMotClef: string;
    f: Suivi<PartielRécursif<ÉpingleMotClef> | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const favoris = this.service("favoris");

    return await favoris.suivreFavorisObjet({
      idObjet: idMotClef,
      f: async (épingle) => {
        await f(
          épingle?.type === "mot-clef"
            ? (épingle as PartielRécursif<ÉpingleMotClef>)
            : undefined,
        );
      },
      idCompte,
    });
  }

  async désépingler({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const favoris = this.service("favoris");

    await favoris.désépinglerFavori({ idObjet: idMotClef });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisBooléenniséeAvecId<ÉpingleMotClef>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    await f(new Set(épingle.épingle.épingle.base ? [épingle.idObjet] : []));

    return faisRien;
  }

  // Noms

  async sauvegarderNoms({
    idMotClef,
    noms,
  }: {
    idMotClef: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idMotClef });

    const { motClef, oublier } = await this.ouvrirMotClef({
      idMotClef,
    });

    for (const lng in noms) {
      await motClef.set(`noms/${lng}`, noms[lng]);
    }

    await oublier();
  }

  async sauvegarderNom({
    idMotClef,
    langue,
    nom,
  }: {
    idMotClef: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this.confirmerPermission({ idMotClef });

    const { motClef, oublier } = await this.ouvrirMotClef({
      idMotClef,
    });

    await motClef.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNom({
    idMotClef,
    langue,
  }: {
    idMotClef: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idMotClef });
    const { motClef, oublier } = await this.ouvrirMotClef({
      idMotClef,
    });
    await motClef.del(`noms/${langue}`);

    await oublier();
  }

  @cacheSuivi
  async suivreNoms({
    idMotClef,
    f,
  }: {
    idMotClef: string;
    f: Suivi<TraducsTexte | undefined>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idMotClef,
      type: "nested",
      schéma: schémaMotClef,
      f: (motClef) => f(toObject(motClef).noms || {}),
    });
  }

  // Descriptions

  async sauvegarderDescriptions({
    idMotClef,
    descriptions,
  }: {
    idMotClef: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    await this.confirmerPermission({ idMotClef });
    const { motClef, oublier } = await this.ouvrirMotClef({
      idMotClef,
    });
    for (const lng in descriptions) {
      await motClef.set(`descriptions/${lng}`, descriptions[lng]);
    }
    await oublier();
  }

  async sauvegarderDescription({
    idMotClef,
    langue,
    description,
  }: {
    idMotClef: string;
    langue: string;
    description: string;
  }): Promise<void> {
    await this.confirmerPermission({ idMotClef });
    const { motClef, oublier } = await this.ouvrirMotClef({
      idMotClef,
    });
    await motClef.set(`descriptions/${langue}`, description);
    await oublier();
  }

  async effacerDescription({
    idMotClef,
    langue,
  }: {
    idMotClef: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idMotClef });
    const { motClef, oublier } = await this.ouvrirMotClef({
      idMotClef,
    });
    await motClef.del(`descriptions/${langue}`);
    await oublier();
  }

  @cacheSuivi
  async suivreDescriptions({
    idMotClef,
    f,
  }: {
    idMotClef: string;
    f: Suivi<{ [key: string]: string }>;
  }): Promise<Oublier> {
    return await this.service("orbite").suivreDonnéesBd({
      id: idMotClef,
      type: "nested",
      schéma: schémaMotClef,
      f: (motClef) => f(toObject(motClef).descriptions || {}),
    });
  }

  // Qualité

  @cacheSuivi
  async suivreScoreQualité({
    idMotClef,
    f,
  }: {
    idMotClef: string;
    f: Suivi<number>;
  }): Promise<Oublier> {
    return await this.suivreNoms({
      idMotClef,
      f: (noms) => f(noms && Object.keys(noms).length ? 1 : 0),
    });
  }
}
