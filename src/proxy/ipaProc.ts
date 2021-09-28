import OrbitDB from "orbit-db";
import générerProxy, {
  téléClient,
  MessageDeTravailleur,
  MessagePourTravailleur,
  MessageErreurDeTravailleur,
  ProxyClientConstellation,
} from "./proxy";
import GestionnaireClient from "./gestionnaireClient";

export class IPAProc extends téléClient {
  client: GestionnaireClient;

  constructor() {
    super();

    this.client = new GestionnaireClient(
      (e: MessageDeTravailleur) => {
        this.emit("message", e)
      },
      (e: Error) => {
        const messageErreur: MessageErreurDeTravailleur = {
          type: "erreur",
          erreur: e
        }
        this.emit("erreur", messageErreur)
      }
    );
  }

  recevoirMessage(message: MessagePourTravailleur) {
    this.client.gérerMessage(message);
  }
}

export default (idBdRacine?: string, souleverErreurs=false, orbite?: OrbitDB, sujetRéseau?: string): ProxyClientConstellation => {
  return générerProxy(new IPAProc(), souleverErreurs, idBdRacine, orbite, sujetRéseau)
}
