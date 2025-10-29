import { EnveloppeCrabe } from "./enveloppe.js";
import type { MessageDIpa, MessageErreurDIpa } from "@constl/mandataire";

const fMessage = (message: MessageDIpa) => postMessage(message);

const fErreur = ({
  erreur,
  idRequête,
  code,
}: {
  erreur: string;
  idRequête?: string;
  code?: string;
}) => {
  const messageErreur: MessageErreurDIpa = {
    type: "erreur",
    idRequête,
    erreur,
    codeErreur: code,
  };
  postMessage(messageErreur);
};

let ipa: EnveloppeCrabe;
onmessage = async function ({ data }) {
  if (!ipa) {
    if (data.type === "init") {
      ipa = new EnveloppeCrabe(fMessage, fErreur, data.opts);
    } else {
      throw Error("Crabe non initialisée");
    }
  } else {
    ipa.gérerMessage(data);
  }
};
