import { faisRien } from "@constl/utils-ipa";
import { cacheSuivi } from "./nébuleuse/cache.js";
import { mapÀObjet } from "./nébuleuse/utils.js";
import { TOUS_DISPOSITIFS, résoudreDéfauts } from "./nébuleuse/services/favoris.js";
import { schémaTraducsTexte } from "./schémas.js";
import { RechercheMotsClefs } from "./recherche/motsClefs.js";
import { ObjetConstellation } from "./objets.js";
import type { Rôle } from "./nébuleuse/services/compte/accès/types.js";
import type { ServicesLibp2pNébuleuse } from "./nébuleuse/services/libp2p/libp2p.js";
import type {
  BaseÉpingleFavoris,
  ÉpingleFavorisBooléenniséeAvecId,
} from "./nébuleuse/services/favoris.js";
import type { InfoAuteur, PartielRécursif, TraducsTexte } from "./types.js";
import type { Oublier, Suivi } from "./nébuleuse/types.js";
import type { Constellation } from "./constellation.js";
import type { JSONSchemaType } from "ajv";
import type { TypedNested } from "@constl/bohr-db";

// Types structure

export type StructureMotClef = {
  type: "mot-clef";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
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
  type: "mot-clef";
  épingle: ContenuÉpingleMotClef;
};

export type ContenuÉpingleMotClef = BaseÉpingleFavoris;

export class MotsClefs<
  L extends ServicesLibp2pNébuleuse,
> extends ObjetConstellation<"motsClefs", StructureMotClef, L> {
  recherche: RechercheMotsClefs<L>;

  schémaObjet = schémaMotClef;

  constructor({ appli }: { appli: Constellation }) {
    super({
      clef: "motsClefs",
      appli,
      dépendances: ["favoris", "réseau", "compte", "orbite"],
    });

    this.recherche = new RechercheMotsClefs<L>({
      motsClefs: this,
      constl: this.appli,
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
    return await this.suivreObjets({ f, idCompte });
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
    return this.ajouterProtocole(idMotClef);
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
    await favoris.désépinglerFavori({ idObjet: this.àIdOrbite(idMotClef) });

    // Effacer le mot-clef lui-même
    await this.service("orbite").effacerBd({ id: this.àIdOrbite(idMotClef) });
  }

  async ajouterÀMesMotsClefs({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    return await this.ajouterÀMesObjets({ idObjet: idMotClef });
  }

  async enleverDeMesMotsClefs({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    return await this.enleverDeMesObjets({ idObjet: idMotClef });
  }

  async ouvrirMotClef({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<{ motClef: TypedNested<StructureMotClef>; oublier: Oublier }> {
    const { objet: motClef, oublier } = await this.ouvrirObjet({
      idObjet: idMotClef,
    });
    return { motClef, oublier };
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
      idObjet: this.àIdOrbite(idMotClef),
      identité: idCompte,
      rôle,
    });
  }

  @cacheSuivi
  async suivreAuteurs({
    idMotClef,
    f,
  }: {
    idMotClef: string;
    f: Suivi<InfoAuteur[]>;
  }): Promise<Oublier> {
    return await this.suivreAuteursObjet({ idObjet: idMotClef, f });
  }

  async confirmerPermission({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: this.àIdOrbite(idMotClef) })))
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
    await favoris.épinglerFavori({
      idObjet: idMotClef,
      épingle: { type: "mot-clef", épingle },
    });
  }

  async suivreÉpingle({
    idMotClef,
    f,
    idCompte,
  }: {
    idMotClef: string;
    f: Suivi<ÉpingleMotClef | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const favoris = this.service("favoris");

    return await favoris.suivreFavoris({
      idCompte,
      f: async (épingles) => {
        const épingleMotClef = épingles?.find(({ idObjet, épingle }) => {
          return idObjet === this.àIdOrbite(idMotClef) &&
            épingle.type === "mot-clef"
            ? épingle
            : undefined;
        }) as ÉpingleMotClef | undefined;
        await f(épingleMotClef);
      },
    });
  }

  async désépingler({ idMotClef }: { idMotClef: string }): Promise<void> {
    const favoris = this.service("favoris");

    await favoris.désépinglerFavori({ idObjet: this.àIdOrbite(idMotClef) });
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
    return await this.suivreObjet({
      idObjet: idMotClef,
      f: (motClef) => f(motClef.noms || {}),
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
    return await this.suivreObjet({
      idObjet: idMotClef,
      f: (motClef) => f(motClef.descriptions || {}),
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
