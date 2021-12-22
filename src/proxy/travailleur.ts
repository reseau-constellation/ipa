import GestionnaireClient from "./gestionnaireClient";
import { MessageDeTravailleur, MessageErreurDeTravailleur } from "./messages";

const fMessage = (message: MessageDeTravailleur) => postMessage(message);

const fErreur = (erreur: Error, id?: string) => {
  const messageErreur: MessageErreurDeTravailleur = {
    type: "erreur",
    id,
    erreur,
  };
  postMessage(messageErreur);
};

let client: GestionnaireClient
onmessage = async function ({ data }) {
  if (!client) {
    if (data.type === "init") {
      client = new GestionnaireClient(fMessage, fErreur, data.opts);
    } else {
      throw Error("Client non initialisé")
    }
  } else {
    client.gérerMessage(data);
  }
};
