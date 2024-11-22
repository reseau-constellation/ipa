import {
  générerMandataire,
  MandataireConstellation,
  Mandatairifiable,
  type MessageDIpa,
  type MessagePourIpa,
} from "@constl/mandataire";
import type {
  Constellation,
  optsConstellation,
  optsInitOrbite,
} from "@/client.js";

export class MandataireTravailleur extends Mandatairifiable {
  travailleur: Worker;

  constructor(opts: optsIpaTravailleur) {
    super();

    this.travailleur = new Worker(new URL("./travailleur.js"));
    this.travailleur.onerror = (e: ErrorEvent) => {
      this.recevoirMessageDIpa({ type: "erreur", erreur: e.error });
    };
    this.travailleur.onmessage = (e: MessageEvent<MessageDIpa>) => {
      this.recevoirMessageDIpa(e.data);
    };

    this.travailleur.postMessage({ type: "init", opts });
  }

  envoyerMessageÀIpa(message: MessagePourIpa): void {
    this.travailleur.postMessage(message);
  }
}

export interface optsIpaTravailleur extends optsConstellation {
  orbite?: Omit<optsInitOrbite, "ipfs">;
}

export const confirmerOptsTravailleur = (
  opts?: optsConstellation,
): optsIpaTravailleur => {
  const optsIpa: optsIpaTravailleur = {};
  if (opts?.dossier) optsIpa.dossier = opts.dossier;
  if (opts?.sujetRéseau) optsIpa.sujetRéseau = opts.sujetRéseau;
  if (opts?.protocoles) optsIpa.protocoles = opts.protocoles;
  if (opts?.orbite) {
    optsIpa.orbite = {
      directory: opts.orbite.directory,
      id: opts.orbite.id,
    };
  }
  return optsIpa;
};

export const générerMandataireTravailleur = (
  opts: optsIpaTravailleur = {},
): MandataireConstellation<Constellation> => {
  return générerMandataire(new MandataireTravailleur(opts));
};
