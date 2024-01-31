import type {
  ClientConstellation,
  optsConstellation,
  optsInitOrbite,
} from "@/client.js";

import {
  générerMandataire,
  ClientMandatairifiable,
  MandataireClientConstellation,
} from "@constl/mandataire";

import type {
  MessageDeTravailleur,
  MessagePourTravailleur,
} from "@/mandataire/messages.js";

export class MandataireClientTravailleur extends ClientMandatairifiable {
  travailleur: Worker;

  constructor(opts: optsIpaTravailleur) {
    super();

    this.travailleur = new Worker(new URL("./travailleur.js"));
    this.travailleur.onerror = (e: ErrorEvent) => {
      this.événements.emit("erreur", { erreur: e.error });
    };
    this.travailleur.onmessage = (e: MessageEvent<MessageDeTravailleur>) => {
      this.événements.emit("message", e.data);
    };

    this.travailleur.postMessage({ type: "init", opts });
  }

  envoyerMessage(message: MessagePourTravailleur): void {
    this.travailleur.postMessage(message);
  }
}

export interface optsIpaTravailleur extends optsConstellation {
  compte?: string;
  sujetRéseau?: string;
  orbite?: {
    dossier?: string;
    sfip?: {
      dossier?: string;
    };
  };
}

export const confirmerOptsTravailleur = (
  opts?: optsConstellation,
): optsIpaTravailleur => {
  const optsIpa: optsIpaTravailleur = {};
  if (opts?.compte) optsIpa.compte = opts.compte;
  if (opts?.sujetRéseau) optsIpa.sujetRéseau = opts.sujetRéseau;
  if (opts?.protocoles) optsIpa.protocoles = opts.protocoles;
  if (opts?.orbite) {
    optsIpa.orbite = {};
    const { dossier, sfip } = opts.orbite as optsInitOrbite;
    if (dossier) optsIpa.orbite.dossier = dossier;
    if (sfip) optsIpa.orbite.sfip = { dossier: sfip.dossier };
  }
  return optsIpa;
};

export const générerMandataireTravailleur = (
  opts: optsIpaTravailleur = {},
): MandataireClientConstellation<ClientConstellation> => {
  return générerMandataire(new MandataireClientTravailleur(opts));
};
