import EventEmitter from "events";
import Semaphore from "@chriscdn/promise-semaphore";
import type { Base58 } from "@localfirst/auth";
import type TypedEmitter from "typed-emitter";

const importationAuth = import("@localfirst/auth");
const importationCrypto = import("@localfirst/crypto");

const verrouImportation = new Semaphore();
let auth: Awaited<typeof importationAuth>;
const obtAuth = async (): Promise<Awaited<typeof importationAuth>> => {
  await verrouImportation.acquire("auth");
  if (!auth) auth = await importationAuth;
  verrouImportation.release("auth");
  return auth;
};

let crypto: Awaited<typeof importationCrypto>;
const obtCrypto = async (): Promise<Awaited<typeof importationCrypto>> => {
  await verrouImportation.acquire("crypto");
  if (!crypto) crypto = await importationCrypto;
  verrouImportation.release("crypto");
  return crypto;
};

export interface Encryption {
  nom: string;

  obtClefs(): Promise<{ publique: string; secrète: string }>;
  encrypter({
    message,
    clefPubliqueDestinataire,
  }: {
    message: string;
    clefPubliqueDestinataire: string;
  }): Promise<string>;

  décrypter({
    message,
    clefPubliqueExpéditeur,
  }: {
    message: string;
    clefPubliqueExpéditeur: string;
  }): Promise<string>;

  clefAléatoire(): Promise<string>;

  // Nécessaire pour le mandataire
  obtNom(): Promise<string>;
}

type ÉvénementsEncryptionLocalFirst = {
  clefs: (args: { secrète: Base58; publique: Base58 }) => void;
};

export class EncryptionLocalFirst implements Encryption {
  événements: TypedEmitter<ÉvénementsEncryptionLocalFirst>;
  clefs?: { publique: Base58; secrète: Base58 };
  nom = "local-first-auth";

  constructor() {
    this.événements =
      new EventEmitter() as TypedEmitter<ÉvénementsEncryptionLocalFirst>;

    obtAuth().then(({ asymmetric }) => {
      const { publicKey, secretKey } = asymmetric.keyPair();
      this.clefs = { secrète: secretKey, publique: publicKey };
      this.événements.emit("clefs", this.clefs);
    });
  }

  async obtClefs(): Promise<{ publique: Base58; secrète: Base58 }> {
    const clefs =
      this.clefs ||
      (await new Promise<{ publique: Base58; secrète: Base58 }>((résoudre) => {
        this.événements.once("clefs", résoudre);
      }));
    return clefs;
  }

  async encrypter({
    message,
    clefPubliqueDestinataire,
  }: {
    message: string;
    clefPubliqueDestinataire: string;
  }): Promise<string> {
    const { asymmetric } = await obtAuth();
    const clefs = await this.obtClefs();

    return asymmetric
      .encrypt({
        secret: message,
        recipientPublicKey: clefPubliqueDestinataire as Base58,
        senderSecretKey: clefs.secrète as Base58,
      })
      .toString();
  }

  async décrypter({
    message,
    clefPubliqueExpéditeur,
  }: {
    message: string;
    clefPubliqueExpéditeur: string;
  }): Promise<string> {
    const { asymmetric } = await obtAuth();
    const clefs = await this.obtClefs();

    const décrypté = asymmetric.decrypt({
      cipher: message as Base58,
      recipientSecretKey: clefs.secrète as Base58,
      senderPublicKey: clefPubliqueExpéditeur as Base58,
    });
    return décrypté;
  }

  async clefAléatoire(n: number = 6): Promise<string> {
    const { randomKey } = await obtCrypto();
    return randomKey(n);
  }

  async obtNom(): Promise<string> {
    return this.nom;
  }
}
