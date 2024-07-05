import { EnveloppeIpa } from "./enveloppe.js";
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
    id: idRequête,
    erreur,
    codeErreur: code,
  };
  postMessage(messageErreur);
};

let ipa: EnveloppeIpa;
onmessage = async function ({ data }) {
  if (!ipa) {
    if (data.type === "init") {
      ipa = new EnveloppeIpa(fMessage, fErreur, data.opts);
    } else {
      throw Error("Constellation non initialisée");
    }
  } else {
    ipa.gérerMessage(data);
  }
};
