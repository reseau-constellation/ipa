import { ignorerNonDéfinis } from "@constl/utils-ipa";
import { Tableaux } from "../tableaux.js";
import type { TraducsTexte } from "../types.js";
import type { Suivi, Oublier } from "../crabe/types.js";
import type { ServicesConstellation } from "../constellation.js";
import type { Nuées, ValeurAscendance } from "./nuées.js";
import type { InfoColonne } from "../tableaux.js";
import type { ServicesLibp2pCrabe } from "../crabe/services/libp2p/libp2p.js";
import type { RègleColonne } from "../règles.js";

export class TableauxNuées<L extends ServicesLibp2pCrabe> extends Tableaux<L> {
  nuées: Nuées<L>;

  constructor({
    nuées,
    service,
  }: {
    nuées: Nuées<L>
    service: <T extends keyof ServicesConstellation<L>>(
      service: T,
    ) => ServicesConstellation<L>[T];
  }) {
    super({ service });
    this.nuées = nuées
  }

  // Noms

  async suivreNoms({ idStructure, idTableau, f, }: { idStructure: string; idTableau: string; f: Suivi<TraducsTexte>; }): Promise<Oublier> {
    return await this.nuées.suivreDeParents<TraducsTexte>({
      idNuée: idStructure,
      f: async (noms) => await f(Object.assign({}, ...noms.map(({val})=>val))),
      fParents: async ({ idNuée, f }) => await super.suivreNoms({
        idStructure: idNuée,
        idTableau,
        f: ignorerNonDéfinis(f)
      })
    })
  }

  // Colonnes

  async suivreSourceColonnes({ idStructure, idTableau, f, }: { idStructure: string; idTableau: string; f: Suivi<ValeurAscendance<InfoColonne[]>[]>; }): Promise<Oublier> {
    return await this.nuées.suivreDeParents<InfoColonne[]>({
      idNuée: idStructure,
      f,
      fParents: async ({ idNuée, f }) => await super.suivreColonnes({
        idStructure: idNuée,
        idTableau,
        f: ignorerNonDéfinis(f)
      })
    })
  }

  async suivreColonnes({ idStructure, idTableau, f, }: { idStructure: string; idTableau: string; f: Suivi<InfoColonne[] | undefined>; }): Promise<Oublier> {
    return await this.suivreSourceColonnes({
      idStructure,
      idTableau,
      f: async colonnes => await f(colonnes.map(c=>c.val).flat())
    })
  }

  // Règles
  
  async suivreRègles({ idStructure, idTableau, f, }: { idStructure: string; idTableau: string; f: Suivi<RègleColonne[]>; }): Promise<Oublier> {

    const enleverDupliquées = (règles: RègleColonne[]): RègleColonne[] => {
      // Nécessaire pour dédupliquer les règles provonenant des variables,
      // lesquelles seront présentes sur chacune des nuées ascendantes.
      const déjàVues = new Set<string>();

      return règles.filter(r => {
        if (déjàVues.has(r.règle.id)) return false;
        déjàVues.add(r.règle.id)
        return true;
      })
    }

    return await this.nuées.suivreDeParents<RègleColonne[]>({
      idNuée: idStructure,
      f: async règles => {
        await f(enleverDupliquées(règles.map(r=>r.val).flat()))
      },
      fParents: async ({ idNuée, f }) => await super.suivreRègles({
        idStructure: idNuée,
        idTableau,
        f
      })
    })
  }

}