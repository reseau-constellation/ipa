import GestionnaireClient from "./gestionnaireClient.js";
import { MessageDeTravailleur, MessageErreurDeTravailleur } from "./messages.js";

const fMessage = (message: MessageDeTravailleur) => postMessage(message);

const fErreur = (erreur: string, id?: string) => {
  const messageErreur: MessageErreurDeTravailleur = {
    type: "erreur",
    id,
    erreur,
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
