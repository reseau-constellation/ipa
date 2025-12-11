import { ignorerNonDéfinis, suivreDeFonctionListe } from "@constl/utils-ipa";
import { typedNested } from "@constl/bohr-db";
import { toObject, type NestedValueObject } from "@orbitdb/nested-db";
import { isValidAddress } from "@orbitdb/core";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { cacheSuivi } from "./crabe/cache.js";
import { ajouterPréfixeOrbite, enleverPréfixeOrbite } from "./utils.js";
import { CONFIANCE_DE_COAUTEUR } from "./crabe/services/consts.js";
import type { TypedNested } from "@constl/bohr-db";
import type { Constellation } from "./index.js";
import type { Oublier, Suivi } from "./crabe/types.js";
import type { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import type { ServicesConstellation } from "./constellation.js";
import type { InfoAuteur, PartielRécursif } from "./types.js";
import type { JSONSchemaType } from "ajv";
import type { ServicesNécessairesCompte } from "./crabe/services/compte/index.js";
import type { AccèsUtilisateur } from "./crabe/services/compte/accès/types.js";

export type StructureServiceObjet = {
  [idObjet: string]: null;
};

export const schémaServiceObjet: JSONSchemaType<
  PartielRécursif<StructureServiceObjet>
> = {
  type: "object",
  additionalProperties: true,
  required: [],
};

export abstract class ObjetConstellation<
  C extends string,
  S extends NestedValueObject,
  L extends ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<
  C,
  StructureServiceObjet,
  L,
  ServicesConstellation
> {
  abstract schémaObjet: JSONSchemaType<PartielRécursif<S>>;

  constructor({
    clef,
    dépendances,
    nébuleuse,
  }: {
    clef: C;
    dépendances: Extract<
      keyof (ServicesConstellation & ServicesNécessairesCompte<L>),
      string
    >[];
    nébuleuse: Constellation;
  }) {
    super({
      clef,
      nébuleuse,
      dépendances,
      options: {
        schéma: schémaServiceObjet,
      },
    });

    const réseau = this.service("réseau");
    réseau.inscrireRésolutionConfiance({
      clef: this.clef,
      résolution: this.résolutionConfiance.bind(this),
    });
  }

  private get préfixeProtocole() {
    return `/constl/${this.clef}`;
  }

  ajouterProtocole(id: string): string {
    if (!id.startsWith(this.préfixeProtocole)) {
      id = `${this.préfixeProtocole}${ajouterPréfixeOrbite(id)}`;
    }
    return id;
  }

  enleverProtocole(id: string): string {
    return enleverPréfixeOrbite(this.àIdOrbite(id));
  }

  àIdOrbite(id: string): string {
    if (id.startsWith(this.préfixeProtocole))
      id = id.replace(this.préfixeProtocole, "");
    return id;
  }

  identifiantValide(identifiant: string): boolean {
    return (
      identifiant.startsWith(`/constl/${this.clef}/orbitdb/`) &&
      isValidAddress(identifiant.replace(`/constl/${this.clef}/orbitdb/`, ""))
    );
  }

  async ajouterÀMesObjets({ idObjet }: { idObjet: string }): Promise<void> {
    const bd = await this.bd();
    await bd.put(this.enleverProtocole(idObjet), null);
  }

  async enleverDeMesObjets({ idObjet }: { idObjet: string }): Promise<void> {
    const bd = await this.bd();
    await bd.del(this.enleverProtocole(idObjet));
  }

  @cacheSuivi
  async suivreObjets({
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
          f: async (objets) =>
            await fSuivreRacine(
              objets
                ? Object.keys(objets).map(this.ajouterProtocole.bind(this))
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

  async ouvrirObjet({
    idObjet,
  }: {
    idObjet: string;
  }): Promise<{ objet: TypedNested<S>; oublier: Oublier }> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: this.àIdOrbite(idObjet),
      type: "nested",
    });
    return {
      objet: typedNested<S>({ db: bd, schema: this.schémaObjet }),
      oublier,
    };
  }

  async suivreObjet({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: Suivi<S>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    return await orbite.suivreDonnéesBd({
      id: this.àIdOrbite(idObjet),
      type: "nested",
      schéma: this.schémaObjet,
      f: (objet) => f(toObject(objet) as S),
    });
  }

  // Auteurs

  async suivreAuteursObjet({
    idObjet,
    f,
  }: {
    idObjet: string;
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
          idObjet: idObjet,
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
        return await this.suivreObjets({
          idCompte,
          f: async (objetsCompte) => {
            return await fSuivreBranche({
              idCompte,
              accepté: (objetsCompte || []).includes(idObjet),
              rôle: branche.rôle,
            });
          },
        });
      },
      fIdDeBranche: (x) => x.idCompte,
      f,
    });
  }

  // Confiance réseau

  async résolutionConfiance({
    de,
    f,
  }: {
    de: string;
    f: Suivi<{
      idCompte: string;
      confiance: number;
    }[]>;
  }): Promise<Oublier> {
    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) => {
        return await this.suivreObjets({
          idCompte: de,
          f: ignorerNonDéfinis(fSuivreRacine),
        });
      },
      fBranche: async ({
        id: idObjet,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<InfoAuteur[]>;
      }) => {
        return await this.suivreAuteursObjet({ idObjet, f: fSuivreBranche });
      },
      f: async (auteurs: InfoAuteur[]) => {
        // On a pas besoin de vérifier l'acceptation des invitations car ça n'affecte que les confiances 
        // rapportées pour le compte de la personne qui a invité
        const idsComptes = [...new Set(auteurs.map(a=>a.idCompte))];

        return await f(idsComptes.map(idCompte => {
          const n = auteurs.map(a=>a.idCompte === idCompte).length
          const confiance = 1 - (1-CONFIANCE_DE_COAUTEUR)**n
          return {idCompte, confiance}
        }));
      },
    });
  }

}
