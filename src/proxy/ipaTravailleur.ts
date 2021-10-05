import générerProxy, {
  téléClient,
  MessageDeTravailleur,
  MessagePourTravailleur,
  ProxyClientConstellation,
} from "./proxy";

export class IPATravailleur extends téléClient {
  travailleur: Worker;

  constructor() {
    super();

    this.travailleur = new Worker(new URL("./travailleur.js", import.meta.url));
    this.travailleur.onerror = (e: ErrorEvent) => {
      this.emit("erreur", e.error);
    };
    this.travailleur.onmessage = (e: MessageEvent<MessageDeTravailleur>) => {
      this.emit("message", e.data);
    };
  }

  recevoirMessage(message: MessagePourTravailleur): void {
    this.travailleur.postMessage(message);
  }
}


export default (idBdRacine?: string, souleverErreurs=false, sujetRéseau?: string): ProxyClientConstellation => {
  return générerProxy(new IPATravailleur(), souleverErreurs, idBdRacine, undefined, sujetRéseau)
}
