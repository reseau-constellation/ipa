import {
  faisRien,
  ignorerNonDéfinis,
  suivreFonctionImbriquée,
} from "@constl/utils-ipa";
import { TypedEmitter } from "tiny-typed-emitter";
import PQueue from "p-queue";
import { pipe } from "it-pipe";
import {
  fromString as uint8ArrayFromString,
  toString as uint8ArrayToString,
} from "uint8arrays";
import { ajouterPréfixes, enleverPréfixesEtOrbite } from "@/v2/utils.js";
import { cacheRechercheParProfondeur, cacheSuivi } from "../../cache.js";
import {
  PROTOCOLE_NÉBULEUSE,
  FACTEUR_ATÉNUATION_CONFIANCE_NÉGATIVE,
  FACTEUR_ATÉNUATION_CONFIANCE_POSITIVE,
} from "../consts.js";
import { ServiceDonnéesAppli } from "../services.js";
import { MODÉRATRICE, estContrôleurNébuleuse } from "../compte/accès/index.js";
import { appelerLorsque, combinerConfiances } from "../utils.js";
import type { ServicesNécessairesDonnées } from "../services.js";
import type { Libp2pEvents } from "@libp2p/interface";
import type { JSONSchemaType } from "ajv";
import type { OptionsAppli } from "@/v2/nébuleuse/appli/appli.js";
import type { PartielRécursif } from "@/v2/types.js";
import type { Oublier, RetourRechercheProfondeur, Suivi } from "../../types.js";

// Types connexions

export type ConnexionLibp2p = { pair: string; adresses: string[] };

export type ConnexionDispositif = {
  idDispositif: string;
  adresses: string[];
};

export type ConnexionCompte = {
  idCompte: string;
  dispositifs;
};

// Types relations

export type CompteBloqué = { idCompte: string; privé: boolean };

export type RelationRéseau = {
  de: string;
  pour: string;
  confiance: number;
  profondeur: number;
};

export type RelationImmédiate = { idCompte: string; confiance: number };

// Constantes

const CLEF_COMPTES_BLOQUÉS = "comptes bloqués";

const FIABLE = "FIABLE";

const BLOQUÉ = "BLOQUÉ";

const ÉVÉNEMENT_BLOQUÉ_PRIVÉ = "changement bloqués privé";

// Types structure

export type StructureRéseau = {
  [idCompte: string]: typeof FIABLE | typeof BLOQUÉ;
};

export const schémaRéseau: JSONSchemaType<PartielRécursif<StructureRéseau>> & {
  nullable: true;
} = {
  type: "object",
  additionalProperties: {
    type: "string"
  },
  nullable: true,
};

export type ServicesNécessairesRéseau = ServicesNécessairesDonnées<{
  réseau: StructureRéseau;
}>;

export class ServiceRéseau extends ServiceDonnéesAppli<
  "réseau",
  StructureRéseau
> {
  événements: TypedEmitter<{
    démarré: (args: { oublier: Oublier }) => void;
    [ÉVÉNEMENT_BLOQUÉ_PRIVÉ]: (bloqués: Set<string>) => void;
  }>;

  bloquésPrivé: Set<string>;

  résolutionsConfiance: Map<
    string,
    (args: { de: string; f: Suivi<RelationImmédiate[]> }) => Promise<Oublier>
  >;

  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesRéseau;
    options: OptionsAppli;
  }) {
    super({
      clef: "réseau",
      services,
      dépendances: [
        "compte",
        "orbite",
        "hélia",
        "libp2p",
        "stockage",
        "journal",
      ],
      options,
    });

    this.bloquésPrivé = new Set();
    this.événements = new TypedEmitter();
    this.résolutionsConfiance = new Map();
  }

  // Cycle de vie

  async démarrer(): Promise<{ idTopologie: string }> {
    await this.restaurerBloquésPrivé();
    const libp2p = await this.service("libp2p").libp2p();
    const compte = this.service("compte");
    const orbite = this.service("orbite");
    this.estDémarré = { idTopologie: "à faire" };
    return await super.démarrer();

    // github.com/libp2p/js-libp2p-example-protocol-and-stream-muxing/commit/a9a393336f60a6b093e2d8ec7f9daab9fbdcd693

    await libp2p.handle(
      PROTOCOLE_NÉBULEUSE,
      async ({ stream, connection }) => {
        const idPair = connection.remotePeer.toCID().toString();
        pipe(stream, (source) =>
          (async function () {
            for await (const msg of source) {
              const { message, signature } = JSON.parse(
                uint8ArrayToString(msg.subarray()),
              );

              // Assurer que la signature est valide (message envoyé par détenteur de idDispositif)
              const signatureValide = await orbite.vérifierSignature({
                signature,
                message: JSON.stringify(message),
              });
              if (!signatureValide) return;

              const { idCompte, idDispositif } = message;
              this.lorsqueDispositifConnecté({
                idCompte,
                idDispositif,
                idPair,
              });
            }
          })(),
        );
      },
      {
        runOnLimitedConnection: true,
      },
    );

    const idTopologie = await libp2p.register(
      PROTOCOLE_NÉBULEUSE,
      {
        async onConnect(peerId, conn) {
          const identifiantsCompte = {
            idCompte: await compte.obtIdCompte(),
            idDispositif: await compte.obtIdDispositif(),
          };

          const flux = await conn.newStream(PROTOCOLE_NÉBULEUSE);
          await pipe(
            [uint8ArrayFromString(JSON.stringify(identifiantsCompte))],
            flux,
          );
          flux.close().catch((erreur) => flux.abort(erreur));
        },
        onDisconnect(peerId) {
          this.lorsqueDispositifDéconnecté(peerId);
        },
        notifyOnLimitedConnection: true,
      },
      { signal },
    );

    this.estDémarré = { idTopologie };
    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    const libp2p = await this.service("libp2p").libp2p();
    const { idTopologie } = this.estDémarré;
    libp2p.unregister(idTopologie);
    await libp2p.unhandle([PROTOCOLE_NÉBULEUSE]);

    return await super.fermer();
  }

  async inscrireRésolutionConfiance({
    clef,
    résolution,
  }: {
    clef: string;
    résolution: (args: {
      de: string;
      f: Suivi<RelationImmédiate[]>;
    }) => Promise<Oublier>;
  }) {
    this.résolutionsConfiance.set(clef, résolution);
  }

  // Suivi connexions

  @cacheSuivi
  async suivreConnexionsLibp2p({
    f,
  }: {
    f: Suivi<ConnexionLibp2p[]>;
  }): Promise<Oublier> {
    const libp2p = await this.service("libp2p").libp2p();

    const fFinale = async () => {
      const pairs = libp2p.getPeers();
      const connexions = libp2p.getConnections();

      const pairsEtConnexions = pairs.map((p) => {
        const pair = p.toString();
        const adresses = connexions
          .filter(
            (c) => c.remotePeer.toString() === pair && c.status !== "closed",
          )
          .map((a) => a.remoteAddr.toString());
        return { pair, adresses };
      });
      return await f(pairsEtConnexions);
    };

    const événements: (keyof Libp2pEvents)[] = [
      "peer:connect",
      "peer:disconnect",
      "peer:update",
    ];
    événements.map((é) => libp2p.addEventListener(é, fFinale));

    await fFinale();
    return async () => {
      événements.map((é) => libp2p.removeEventListener(é, fFinale));
    };
  }

  @cacheSuivi
  async suivreConnexionsDispositifs({
    f,
  }: {
    f: Suivi<ConnexionDispositif[]>;
  }): Promise<Oublier> {
    return await this.suivreConnexionsLibp2p({
      f: async (connexions) => {
        await f(connexions.filter().map());
      },
    });
  }

  @cacheSuivi
  async suivreConnexionsComptes({
    f,
  }: {
    f: Suivi<ConnexionCompte[]>;
  }): Promise<Oublier> {
    return await this.suivreConnexionsDispositifs({
      f: async (connexions) => {
        await f(connexions.filter().map());
      },
    });
  }

  @cacheSuivi
  async suivreDispositifsCompte({
    f,
    idCompte,
  }: {
    f: Suivi<{ idDispositif: string; statut: "invité" | "accepté" }[]>;
    idCompte?: string;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    const info: {
      autorisés: string[];
      infos: statutDispositif[];
      idCompte?: string;
    } = { autorisés: [], infos: [] };

    const fSuivi = async ({
      id,
      fSuivre,
    }: {
      id: string;
      fSuivre: Suivi<string[] | undefined>;
    }): Promise<Oublier> => {
      info.idCompte = id;

      // Suivre les dispositifs autorisés sur ce compte
      const { bd, oublier } = await orbite.ouvrirBd({
        id,
        type: "keyvalue",
      });
      const accès = bd.access;
      if (!estContrôleurNébuleuse(accès)) {
        await oublier();
        return faisRien;
      }
      const oublierAutorisés = await accès.suivreDispositifsAutorisées(
        async (a) => {
          await fSuivre(
            a.filter((u) => u.rôle === MODÉRATRICE).map((u) => u.idDispositif),
          );
        },
      );
      return async () => {
        await oublierAutorisés();
        await oublier();
      };
    };

    const fFinale = async () => {
      if (!info.idCompte) return;

      return await f(
        info.autorisés.map((idDispositif) => ({
          idDispositif,
          statut:
            info.infos
              .map((i) => i.infoDispositif)
              .find((i) => i.idDispositif === idDispositif)?.idCompte ===
            info.idCompte
              ? "accepté"
              : "invité",
        })),
      );
    };

    const compte = this.service("compte");
    const oublierDispositifsAutorisés = await suivreFonctionImbriquée({
      fRacine: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (nouvelIdBdCible?: string | undefined) => Promise<void>;
      }): Promise<Oublier> => {
        if (idCompte) {
          await fSuivreRacine(idCompte);
          return faisRien;
        } else {
          return await compte.suivreIdCompte({ f: fSuivreRacine });
        }
      },
      f: ignorerNonDéfinis(async (x: string[]) => {
        info.autorisés = x;
        return await fFinale();
      }),
      fSuivre: fSuivi,
    });

    const oublierInfosDispositifs = await this.suivreConnexionsDispositifs({
      f: async (x) => {
        info.infos = x;
        return await fFinale();
      },
    });

    return async () => {
      await Promise.allSettled([
        oublierDispositifsAutorisés(),
        oublierInfosDispositifs(),
      ]);
    };
  }

  @cacheSuivi
  async suivreComptes({ f }: { f: Suivi<string[]> }): Promise<Oublier> {}

  // Gestion manuelle du réseau

  async faireConfianceAuCompte({
    idCompte,
  }: {
    idCompte: string;
  }): Promise<void> {
    await this.débloquerCompte({ idCompte });
    idCompte = enleverPréfixesEtOrbite(idCompte)

    const bdRéseau = await this.bd();
    await bdRéseau.set(enleverPréfixesEtOrbite(idCompte), FIABLE);
  }

  async nePlusFaireConfianceAuCompte({
    idCompte,
  }: {
    idCompte: string;
  }): Promise<void> {
    const bdRéseau = await this.bd();
    idCompte = enleverPréfixesEtOrbite(idCompte)
    if ((await bdRéseau.get(idCompte)) === FIABLE) await bdRéseau.del(idCompte);
  }

  async bloquerCompte({
    idCompte,
    privé = false,
  }: {
    idCompte: string;
    privé?: boolean;
  }): Promise<void> {
    const bdRéseau = await this.bd();
    idCompte = enleverPréfixesEtOrbite(idCompte)

    if (privé) {
      await this.débloquerCompte({ idCompte }); // Enlever du régistre publique s'il y est déjà
      this.bloquésPrivé.add(idCompte);
      await this.sauvegarderBloquésPrivé();
    } else {
      await bdRéseau.set(idCompte, BLOQUÉ);
    }
  }

  async débloquerCompte({ idCompte }: { idCompte: string }): Promise<void> {
    const bdRéseau = await this.bd();
    idCompte = enleverPréfixesEtOrbite(idCompte)

    if ((await bdRéseau.get(idCompte)) === BLOQUÉ) await bdRéseau.del(idCompte);

    if (this.bloquésPrivé.has(idCompte)) {
      this.bloquésPrivé.delete(idCompte);
      await this.sauvegarderBloquésPrivé();
    }
  }

  private async sauvegarderBloquésPrivé() {
    const stockage = this.service("stockage");

    const bloqués = [...this.bloquésPrivé];

    await stockage.sauvegarderItem({
      clef: CLEF_COMPTES_BLOQUÉS,
      valeur: JSON.stringify(bloqués),
    });

    this.événements.emit(ÉVÉNEMENT_BLOQUÉ_PRIVÉ, this.bloquésPrivé);
  }

  private async restaurerBloquésPrivé(): Promise<void> {
    const stockage = this.service("stockage");
    const journal = this.service("journal");

    const bloquésPrivéChaîne = await stockage.obtenirItem(CLEF_COMPTES_BLOQUÉS);

    if (bloquésPrivéChaîne) {
      try {
        JSON.parse(bloquésPrivéChaîne).forEach((b: string) =>
          this.bloquésPrivé.add(b),
        );
        this.événements.emit(ÉVÉNEMENT_BLOQUÉ_PRIVÉ, this.bloquésPrivé);
      } catch (e) {
        // C'est pas si grave que ça
        journal.écrire(
          "Erreur restauration comptes bloqués privés : " + e.toString(),
        );
      }
    }
  }

  @cacheSuivi
  async suivreComptesFiables({
    f,
    idCompte,
  }: {
    f: Suivi<string[]>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreBd({
      idCompte,
      f: async (statuts) => {
        statuts ??= {};
        await f(Object.keys(statuts).filter((id) => statuts[id] === FIABLE).map(id=>ajouterPréfixes(id, "/nébuleuse/compte")));
      },
    });
  }

  @cacheSuivi
  async suivreComptesBloqués({
    f,
    idCompte,
  }: {
    f: Suivi<CompteBloqué[]>;
    idCompte?: string;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    const bloqués: { publiques: string[]; privés: string[] } = {
      publiques: [],
      privés: [],
    };

    const fFinale = async () => {
      // Si un compte est par erreur bloqué de manière privée et publique en même temps,
      // on va le montrer en tant que publique
      const privés = bloqués.privés.filter(
        (c) => !bloqués.publiques.includes(c),
      );
      return await f([
        ...privés.map((c) => ({ idCompte: c, privé: true })),
        ...bloqués.publiques.map((c) => ({ idCompte: c, privé: false })),
      ]);
    };

    const oublierPubliques = await this.suivreBd({
      idCompte,
      f: async (statuts) => {
        statuts ??= {};
        bloqués.publiques = Object.keys(statuts).filter(
          (id) => statuts[id] === BLOQUÉ,
        ).map(id=>ajouterPréfixes(id, "/nébuleuse/compte"));
        await fFinale();
      },
    });

    const oublierPrivés = await suivreFonctionImbriquée({
      fRacine: async ({ fSuivreRacine }) =>
        await compte.suivreIdCompte({ f: fSuivreRacine }),
      fSuivre: async ({
        id,
        fSuivre,
      }: {
        id: string;
        fSuivre: Suivi<Set<string> | undefined>;
      }) => {
        if (!idCompte || idCompte === id) {
          const oublier = appelerLorsque({
            émetteur: this.événements,
            événement: ÉVÉNEMENT_BLOQUÉ_PRIVÉ,
            f: fSuivre,
          });
          
          await fSuivre(this.bloquésPrivé);
          return oublier
        } else {
          // Si le compte ne correspond pas à notre compte, on ne peut pas deviner
          // les comptes bloqués de manière privée
          await fSuivre(undefined);
          return faisRien;
        }
      },
      f: async (bloquésPrivé) => {
        bloqués.privés = Array.from(bloquésPrivé || []).map(id=>ajouterPréfixes(id, "/nébuleuse/compte"));
        await fFinale();
      },
    });

    return async () => {
      await oublierPubliques();
      await oublierPrivés();
    };
  }

  // Méthodes réseau ambiant

  @cacheRechercheParProfondeur
  async suivreComptesParProfondeur({
    f,
    profondeur,
    idCompte,
  }: {
    f: Suivi<{ idCompte: string; confiance: number; profondeur: number }[]>;
    profondeur?: number;
    idCompte?: string;
  }): Promise<RetourRechercheProfondeur> {
    const résoudreConfiances = (confiances: number[]): number => {
      // Priorité au niveau de confiance spécifié explicitement
      if (confiances.includes(1)) return 1;
      if (confiances.includes(-1)) return -1;

      return combinerConfiances(confiances);
    };

    return await this.suivreRelationsRéseau({
      f: async (relations) => {
        const profondeurMax = Math.max(
          ...relations.map((r) => r.profondeur).filter((p) => p !== Infinity),
        );
        const comptes: {
          [id: string]: { confiances: number[]; profondeur: number };
        } = {};
        for (let p = 1; p <= profondeurMax; p++) {
          const relationsP = relations.filter((r) => r.profondeur === p);
          for (const { pour, de, confiance, profondeur } of relationsP) {
            const confianceCompteSource = résoudreConfiances(
              comptes[de].confiances,
            );
            // On ignore les relations des comptes auxquels nous ne faisons pas confiance
            if (confianceCompteSource > 0) {
              const confianceTransitive =
                confianceCompteSource *
                confiance *
                (confiance > 0
                  ? FACTEUR_ATÉNUATION_CONFIANCE_POSITIVE
                  : FACTEUR_ATÉNUATION_CONFIANCE_NÉGATIVE);
              if (comptes[pour]) {
                // On garde la profondeur moindre initiale
                comptes[pour].confiances.push(confianceTransitive);
              } else {
                comptes[pour] = {
                  confiances: [confianceTransitive],
                  profondeur,
                };
              }
            }
          }
        }

        const finaux = Object.entries(comptes).map(
          ([idCompte, { profondeur, confiances }]) => ({
            idCompte,
            profondeur: profondeur,
            confiance: résoudreConfiances(confiances),
          }),
        );

        return await f(finaux);
      },
      profondeur,
      idCompte,
    });
  }

  @cacheRechercheParProfondeur
  async suivreRelationsRéseau({
    f,
    profondeur,
    idCompte,
  }: {
    f: Suivi<RelationRéseau[]>;
    profondeur?: number;
    idCompte?: string;
  }): Promise<RetourRechercheProfondeur> {
    let annulé = false;

    const relationsImmédiates: {
      [idCompte: string]: { relations: RelationImmédiate[]; oublier: Oublier };
    } = {};

    const queue = new PQueue({ concurrency: 1 });

    const fFinale = async () => {
      const profondeurs = résoudreProfondeurs();
      const relations: RelationRéseau[] = Object.entries(relationsImmédiates)
        .map(([id, { relations }]) =>
          relations.map((r) => ({
            de: id,
            pour: r.idCompte,
            confiance: r.confiance,
            profondeur: profondeurs[id],
          })),
        )
        .flat();
      await f(relations);
    };

    const résoudreProfondeurs = (): { [idCompte: string]: number } => {
      const profondeurs: { [idCompte: string]: number } = { [idCompte]: 0 };
      const profondeurParent = (id: string): number | undefined => {
        const parent = Object.keys(profondeurs).find((idAutre) =>
          relationsImmédiates[idAutre].relations.find((r) => r.idCompte === id),
        );
        return parent ? profondeurs[parent] : undefined;
      };
      const àRésoudre = new Set(Object.keys(relationsImmédiates));
      while (àRésoudre.size) {
        let progrès = false;
        for (const id of àRésoudre.values()) {
          const p = profondeurParent(id);
          if (p !== undefined) {
            progrès = true;
            profondeurs[id] = p + 1;
            àRésoudre.delete(id);
          }
        }
        if (!progrès) {
          // On ignore les relations éventuellement déconnectées du compte initial de la recherche
          break;
        }
      }
      return profondeurs;
    };

    const mettreÀJour = () => {
      const tâche = async () => {
        // Calculer profondeurs des comptes suivis
        const parProfondeur: { [idCompte: string]: number } =
          résoudreProfondeurs();
        const ceuxDontOnVeutSuivreLesRelations = Object.keys(
          parProfondeur,
          // `profondeur !== undefined` est éjà assuré par `cacheRechercheParProfondeur` mais on met ça ici pour les types TS
        ).filter((id) => parProfondeur[id] < (profondeur ?? Infinity) - 1);

        // Oublier les comptes trop profonds (en raison de déconnexion de lien de confiance ou bien de changement de profondeur)
        const àOublier = Object.keys(relationsImmédiates).filter(
          (id) => !ceuxDontOnVeutSuivreLesRelations.includes(id),
        );
        await Promise.all(
          àOublier.map((id) => relationsImmédiates[id].oublier()),
        );

        // Ajouter les comptes à suivre
        const àSuivre = [
          ...new Set(
            ceuxDontOnVeutSuivreLesRelations
              .map((id) =>
                relationsImmédiates[id].relations.map((r) => r.idCompte),
              )
              .flat(),
          ),
        ].filter((id) => !relationsImmédiates[id]);

        await Promise.all(
          àSuivre.map(async (id) => {
            const oublierSuivi = await this.suivreRelationsImmédiates({
              idCompte: id,
              f: async (relations) => {
                relationsImmédiates[id].relations = relations;
                mettreÀJour();
                await fFinale();
              },
            });
            relationsImmédiates[id] = {
              relations: [],
              oublier: async () => {
                await oublierSuivi();
                delete relationsImmédiates[id];
              },
            };
          }),
        );
        await fFinale();
      };

      if (!annulé) queue.add(tâche);
    };

    mettreÀJour();

    const oublier = async () => {
      annulé = true;
      await queue.onIdle();
      await Promise.all(
        Object.values(relationsImmédiates).map((r) => r.oublier()),
      );
    };

    const changerProfondeur = async (p: number) => {
      if (profondeur !== p) {
        profondeur = p;
        mettreÀJour();
      }
    };

    return { oublier, profondeur: changerProfondeur };
  }

  @cacheSuivi
  async suivreRelationsImmédiates({
    f,
    idCompte,
  }: {
    f: Suivi<RelationImmédiate[]>;
    idCompte?: string;
  }): Promise<Oublier> {
    const compte = this.service("compte");

    const suivreRelationsCompte = async ({
      id,
      fSuivre,
    }: {
      id: string;
      fSuivre: Suivi<RelationImmédiate[]>;
    }): Promise<Oublier> => {
      const confiances: {
        bloqués?: string[];
        fiables?: string[];
        inférés: {
          [clef: string]: {
            idCompte: string;
            confiance: number;
          }[];
        };
      } = { inférés: {} };

      const fFinale = async () => {
        const relationsFiables = (confiances.fiables ?? []).map((c) => ({
          idCompte: c,
          confiance: 1,
        }));
        const relationsBloquées = (confiances.bloqués ?? []).map((c) => ({
          idCompte: c,
          confiance: -1,
        }));

        // On priorise les relations explicites
        const inférés = Object.values(confiances.inférés)
          .flat()
          .filter(
            (c) =>
              !confiances.fiables?.includes(c.idCompte) &&
              !confiances.bloqués?.includes(c.idCompte),
          );
        const comptesInférés = [...new Set(inférés.map((x) => x.idCompte))];
        const relationsInférées = comptesInférés.map((c) => {
          const confiancesComptes = inférés
            .filter((i) => i.idCompte === c)
            .map((i) => i.confiance);
          return {
            idCompte: c,
            confiance:
              1 - confiancesComptes.reduce((total, c) => (1 - c) * total, 1),
          };
        });

        return await fSuivre([
          ...relationsFiables,
          ...relationsInférées,
          ...relationsBloquées,
        ]);
      };

      const oublierConfiances: Oublier[] = [];
      for (const [clef, résolution] of this.résolutionsConfiance.entries()) {
        oublierConfiances.push(
          await résolution({
            de: id,
            f: async (x) => {
              confiances.inférés[clef] = x;
              await fFinale();
            },
          }),
        );
      }
      const oublierBloqués = await this.suivreComptesBloqués({
        idCompte,
        f: async (bloqués) => {
          confiances.bloqués = bloqués.map((b) => b.idCompte);
          await fFinale();
        },
      });
      const oublierFiables = await this.suivreComptesFiables({
        idCompte,
        f: async (fiables) => {
          confiances.fiables = fiables;
          await fFinale();
        },
      });

      return async () => {
        await oublierBloqués();
        await oublierFiables();
        await Promise.all(oublierConfiances.map((f) => f()));
      };
    };

    return await suivreFonctionImbriquée({
      fRacine: async ({ fSuivreRacine }) => {
        if (idCompte) {
          await fSuivreRacine(idCompte);
          return faisRien;
        } else {
          return await compte.suivreIdCompte({ f: fSuivreRacine });
        }
      },
      fSuivre: suivreRelationsCompte,
      f: ignorerNonDéfinis(f),
    });
  }

  async suivreConfianceCompte({
    idCompte,
    f,
    idCompteDépart,
  }: {
    idCompte: string;
    f: Suivi<number | undefined>;
    idCompteDépart?: string;
  }): Promise<RetourRechercheProfondeur> {
    /*
    Note : Ne PAS envelopper cette fonction avec un `@cacheRechercheParProfondeur` !
    Elle retourne un nombre, pas une liste de résultats, et ça va bien sûr planter
    si on essaie de l'envelopper.
    */
    return await this.suivreComptesParProfondeur({
      f: async (comptes) =>
        await f(comptes.find((c) => c.idCompte === idCompte)?.confiance),
      idCompte: idCompteDépart,
    });
  }

  // Dispositifs

  async demanderEtPuisRejoindreCompte({ idCompte }): Promise<void> {}

  async inviterÀRejoidreCompte({}) {}

  // Réseautage
}

export const serviceRéseau =
  () =>
  ({
    options,
    services,
  }: {
    options: OptionsAppli;
    services: ServicesNécessairesRéseau;
  }) =>
    new ServiceRéseau({ options, services });
