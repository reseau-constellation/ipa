import { join } from "path";
import { isElectronMain, isNode } from "wherearewe";
import { ERREUR_INIT_IPA_DÉJÀ_LANCÉ } from "@constl/mandataire";
import { ServiceAppli } from "@/v2/nébuleuse/appli/services.js";
import type TypeFs from "fs";
import type { Jsonifiable, Oublier } from "../types.js";
import type {
  OptionsAppli,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";

export const FICHIER_VERROU = "VERROU";
export const INTERVALE_VERROU = 5000; // 5 millisecondes

export type OptionsServiceDossier = {
  dossier?: string;
};

type RetourDémarrageDossier = { dossier: string; déverrouiller: Oublier };

export class ServiceDossier extends ServiceAppli<
  "dossier",
  ServicesAppli,
  RetourDémarrageDossier,
  OptionsServiceDossier
> {
  constructor({ options }: { options: OptionsServiceDossier & OptionsAppli }) {
    super({
      clef: "dossier",
      services: {},
      options,
    });
  }

  async démarrer() {
    const { dossier, déverrouiller } = await this.initialiserDossier();

    this.estDémarré = { dossier, déverrouiller };

    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    const { déverrouiller } = await this.démarré();
    await déverrouiller();
    await super.fermer();
  }

  async dossier(): Promise<string> {
    const { dossier } = await this.démarré();
    return dossier;
  }

  async initialiserDossier(): Promise<{
    dossier: string;
    déverrouiller: Oublier;
  }> {
    let dossier = this.options.dossier;

    const { nomAppli, mode } = this.options;
    if (this.options.dossier) {
      if (isNode || isElectronMain) {
        const fs = await import("fs");
        if (!fs.existsSync(this.options.dossier))
          fs.mkdirSync(this.options.dossier, { recursive: true });
      }
      dossier = this.options.dossier;
    }

    if (!dossier) {
      if (isNode || isElectronMain) {
        const fs = await import("fs");
        // Utiliser l'application native
        const envPaths = (await import("env-paths")).default;
        const chemins = envPaths(nomAppli, { suffix: "" });
        dossier = join(
          chemins.data,
          mode === "dév" ? `${nomAppli}-dév` : nomAppli,
        );
        if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true });
      } else {
        // Pour navigateur
        dossier = `./${this.options.nomAppli}`;
      }
    }
    const déverrouiller = await this.verrouillerDossier(dossier);
    return { dossier, déverrouiller };
  }

  // Fichier verrou

  private async verrouillerDossier(dossier: string): Promise<Oublier> {
    const installé = isElectronMain || isNode;
    let fs: typeof TypeFs;
    if (installé) fs = await import("fs");

    const fichierVerrou = join(dossier, FICHIER_VERROU);
    const verrouillé = () => {
      return (installé) ? fs.existsSync(fichierVerrou) : localStorage.getItem(fichierVerrou)
    }
    const verrouiller = (message: string = "") => {
      if (installé) fs.writeFileSync(fichierVerrou, message)
      else localStorage.setItem(fichierVerrou, JSON.stringify({message, temps: Date.now() }))
    }
    const dernièreModificationVerrou = (): number => {
      if (installé) {
        return fs.statSync(fichierVerrou).mtime.getTime();
      } else {
        return JSON.parse(localStorage.getItem(fichierVerrou) || "{}").temps || -Infinity;
      }
    }
    const obtenirContenuVerrou = (): string => {
      if (installé) {
        return new TextDecoder().decode(
          fs.readFileSync(fichierVerrou),
        );
      } else {
        return JSON.parse(localStorage.getItem(fichierVerrou) || "{}").message || ""
      }
    }
    const actualiserVerrou = () => {
      if (installé) {
        const maintenant = new Date();
        fs.utimesSync(fichierVerrou, maintenant, maintenant)
      } else {
        const message: string = JSON.parse(localStorage.getItem(fichierVerrou) || "{}").message || "" 
        localStorage.setItem(fichierVerrou, JSON.stringify({message, temps: Date.now() }));
      }
    }
    const relâcherVerrou = () => {
      if (installé) fs.rmSync(fichierVerrou);
      else localStorage.removeItem(fichierVerrou);
    }

    if (!verrouillé()) {
      verrouiller();
    } else {
      const verifierSiVieux = () => {
        const maintenant = new Date();

        if (maintenant.getTime() - dernièreModificationVerrou() > INTERVALE_VERROU) {
          verrouiller("");
        } else {
          const contenuFichier = obtenirContenuVerrou();
          const erreur = new Error(
            `Le compte sur ${dossier} est déjà ouvert par un autre processus.\n${contenuFichier}`,
          );
          erreur.name = ERREUR_INIT_IPA_DÉJÀ_LANCÉ;
          throw erreur;
        }
      };
      try {
        verifierSiVieux();
      } catch {
        await new Promise((résoudre) =>
          setTimeout(résoudre, INTERVALE_VERROU * 1.2),
        );
        verifierSiVieux();
      }
    }
    const intervale = setInterval(() => {
      actualiserVerrou();
    }, INTERVALE_VERROU);
    return async () => {
      clearInterval(intervale);
      relâcherVerrou();
    };
  }

  async spécifierMessageVerrou({
    message,
  }: {
    message: Jsonifiable;
  }): Promise<void> {
    const dossier = await this.dossier();
    const fichierVerrou = join(dossier, FICHIER_VERROU);
    if (isElectronMain || isNode) {
      const fs = await import("fs");
      fs.writeFileSync(fichierVerrou, JSON.stringify(message));
    } else {
      localStorage.setItem(fichierVerrou, JSON.stringify({message, temps: Date.now() }));
    }
  }
}

export const serviceDossier =
  (optionsDossier?: OptionsServiceDossier) =>
  ({ options }: { options: OptionsAppli }) => {
    return new ServiceDossier({ options: { ...optionsDossier, ...options } });
  };
