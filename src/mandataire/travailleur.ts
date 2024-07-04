import { GestionnaireClient } from "./gestionnaireClient.js";
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

let client: GestionnaireClient;
onmessage = async function ({ data }) {
  if (!client) {
    if (data.type === "init") {
      client = new GestionnaireClient(fMessage, fErreur, data.opts);
    } else {
      throw Error("Client non initialisé");
    }
  } else {
    client.gérerMessage(data);
  }
};
