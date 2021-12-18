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

const client = new GestionnaireClient(fMessage, fErreur);

onmessage = async function ({ data }) {
  client.gérerMessage(data);
};
