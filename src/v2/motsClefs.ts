import { TypedNested, typedNested } from "@constl/bohr-db";
import { JSONSchemaType } from "ajv";
import { toObject } from "@orbitdb/nested-db";
import { faisRien } from "@constl/utils-ipa";
import { cacheSuivi } from "@/décorateursCache.js";
import { Constellation, ServicesConstellation } from "./constellation.js";
import { Oublier, Suivi } from "./crabe/types.js";
import { PartielRécursif, TraducsTexte } from "./types.js";
import { ServiceDonnéesNébuleuse } from "./crabe/services/services.js";
import { mapÀObjet } from "./crabe/utils.js";
import {
  BaseÉpingleFavoris,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
  ÉpingleFavorisAvecIdBooléennisée,
} from "./favoris.js";
import { ServicesLibp2pCrabe } from "./crabe/services/libp2p/libp2p.js";
import { schémaTraducsTexte } from "./schémas.js";

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
  additionalProperties: {
    type: "null",
    nullable: true,
  },
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

export type ÉpingleMotClef = BaseÉpingleFavoris & {
  type: "mot-clef";
};

export class MotsClefs<
  L extends ServicesLibp2pCrabe,
> extends ServiceDonnéesNébuleuse<
  "motClef",
  StructureServiceMotsClefs,
  L,
  ServicesConstellation
> {
  constructor({ nébuleuse }: { nébuleuse: Constellation }) {
    super({
      clef: "motClef",
      nébuleuse,
      dépendances: ["compte", "orbite"],
      options: {
        schéma: schémaServiceMotsClefs,
      },
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
    return await this.suivreBd({
      idCompte,
      f: async (motsClefs) =>
        await f(motsClefs ? Object.keys(motsClefs) : undefined),
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

    if (épingler) await this.épinglerMotClef({ idMotClef });

    await motClef.put("type", "mot-clef");

    await oublier();
    return idMotClef;
  }

  async copierMotClef({ idMotClef }: { idMotClef: string }): Promise<string> {
    const { motClef, oublier } = await this.ouvrirMotClef({ idMotClef });
    const idNouveauMotClef = await this.créerMotClef();

    const noms = mapÀObjet(await motClef.get("noms"));
    if (noms)
      await this.sauvegarderNomsMotClef({ idMotClef: idNouveauMotClef, noms });

    const descriptions = mapÀObjet(await motClef.get("descriptions"));
    if (descriptions)
      await this.sauvegarderDescriptionsMotClef({
        idMotClef: idNouveauMotClef,
        descriptions,
      });

    await oublier();
    return idNouveauMotClef;
  }

  async effacerMotClef({ idMotClef }: { idMotClef: string }): Promise<void> {
    // Effacer l'entrée dans notre liste de mots-clefs
    await this.enleverDeMesMotsClefs({ idMotClef });
    await this.service("favoris").désépinglerFavori({ idObjet: idMotClef });

    // Effacer le mot-clef lui-même
    await this.service("orbite").effacerBd({ id: idMotClef });
  }

  async ajouterÀMesMotsClefs({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const bd = await this.bd();
    await bd.put(idMotClef, null);
  }

  async enleverDeMesMotsClefs({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    const bd = await this.bd();
    await bd.del(idMotClef);
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

  async épinglerMotClef({
    idMotClef,
    options = {},
  }: {
    idMotClef: string;
    options?: PartielRécursif<ÉpingleMotClef>;
  }) {
    const épingle: ÉpingleMotClef = résoudreDéfauts(options, {
      type: "mot-clef",
      base: TOUS_DISPOSITIFS,
    });
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];
    await favoris.épinglerFavori({ idObjet: idMotClef, épingle });
  }

  async suivreÉpingleMotClef({
    idMotClef,
    f,
    idCompte,
  }: {
    idMotClef: string;
    f: Suivi<PartielRécursif<ÉpingleMotClef> | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    return await favoris.suivreÉtatFavori({
      idObjet: idMotClef,
      f: async (épingle) => {
        await f(
          épingle?.type === "motClef"
            ? (épingle as PartielRécursif<ÉpingleMotClef>)
            : undefined,
        );
      },
      idCompte,
    });
  }

  async désépinglerMotClef({
    idMotClef,
  }: {
    idMotClef: string;
  }): Promise<void> {
    // On court-circuite `this.service("favoris")`
    const favoris = this.nébuleuse.services["favoris"];

    await favoris.désépinglerFavori({ idObjet: idMotClef });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisAvecIdBooléennisée<ÉpingleMotClef>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    await f(new Set(épingle.épingle.base ? [épingle.idObjet] : []));

    return faisRien;
  }

  // Noms

  async sauvegarderNomsMotClef({
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

  async sauvegarderNomMotClef({
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

  async effacerNomMotClef({
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
  async suivreNomsMotClef({
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
      f: (motClef) => f(toObject(motClef).noms),
    });
  }

  // Descriptions

  async sauvegarderDescriptionsMotClef({
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

  async sauvegarderDescriptionMotClef({
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
    await motClef.set(`noms/${langue}`, description);
    await oublier();
  }

  async effacerDescriptionMotClef({
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
  async suivreDescriptionsMotClef({
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
      f: (motClef) => f(toObject(motClef).noms),
    });
  }

  // Qualité

  @cacheSuivi
  async suivreQualitéMotClef({
    idMotClef,
    f,
  }: {
    idMotClef: string;
    f: Suivi<number>;
  }): Promise<Oublier> {
    return await this.suivreNomsMotClef({
      idMotClef,
      f: (noms) => f(noms && Object.keys(noms).length ? 1 : 0),
    });
  }
}
