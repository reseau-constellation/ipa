import { ComposanteClientListe } from "./v2/nébuleuse/services.js";
import type { schémaFonctionOublier, schémaFonctionSuivi } from "@/types.js";
import { cacheSuivi } from "@/décorateursCache.js";
import { schémaBdTableauxDeBd } from "@/bds.js";

export class Nuées extends ComposanteClientListe<string> {
  /*
  async bloquerContenu({
    idNuée,
    // contenu,
  }: {
    idNuée: string;
    contenu: élémentsBd;
  }): Promise<void> {

    throw new Error("Pas encore implémenté")

    await this._confirmerPermission({idNuée});
    const idBdBloqués = await this.client.obtIdBd({
      nom: "bloqués",
      racine: idNuée,
      type: "keyvalue",
    });
    

    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdBloqués,
      type: "set",
      schéma: schémaBdContenuBloqué,
    });
    await bd.add({
      contenu,
    });
    fOublier(); 
  }*/

  async suivreContenuBloqué() {}

  async réordonnerTableauNuée({
    idNuée,
    idTableau,
    position,
  }: {
    idNuée: string;
    idTableau: string;
    position: number;
  }): Promise<void> {
    await this._confirmerPermission({ idNuée });
    const idBdTableaux = await this.client.obtIdBd({
      nom: "tableaux",
      racine: idNuée,
      type: "ordered-keyvalue",
    });

    const { bd: bdTableaux, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdTableaux,
      type: "ordered-keyvalue",
      schéma: schémaBdTableauxDeBd,
    });

    const tableauxExistants = await bdTableaux.all();
    const positionExistante = tableauxExistants.findIndex(
      (t) => t.key === idTableau,
    );
    if (position !== positionExistante)
      await bdTableaux.move(idTableau, position);
    await fOublier();
  }

  @cacheSuivi
  async suivreNuéesParents({
    idNuée,
    f,
  }: {
    idNuée: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    let annulé = false;
    const ascendance: {
      [nuée: string]: { parent: string; fOublier: schémaFonctionOublier };
    } = {};

    const fFinale = async () => {
      await f(Object.values(Object.values(ascendance).map((a) => a.parent)));
    };
    const suivreParent = async ({
      id,
    }: {
      id: string;
    }): Promise<schémaFonctionOublier> => {
      return await this.client.suivreBd({
        id,
        type: "keyvalue",
        schéma: schémaStructureBdNuée,
        f: async (bd) => {
          if (annulé) return;

          const parent = await bd.get("parent");
          if (ascendance[id]?.parent === parent) {
            if (!parent) await fFinale();
            return;
          }

          await ascendance[id]?.fOublier();
          if (parent) {
            const fOublierParent = await suivreParent({ id: parent });
            ascendance[id] = {
              parent,
              fOublier: async () => {
                await fOublierParent();
                await ascendance[parent]?.fOublier();
                delete ascendance[id];
                await fFinale();
              },
            };
          } else {
            delete ascendance[id];
          }

          await fFinale();
        },
      });
    };
    const fOublier = await suivreParent({ id: idNuée });
    return async () => {
      annulé = true;
      await fOublier();
      await Promise.allSettled(
        Object.values(ascendance).map((a) => a.fOublier()),
      );
    };
  }

}
