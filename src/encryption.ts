import type { Base58 } from "@localfirst/auth";

import { asymmetric } from "@localfirst/auth";
import { randomKey } from "@localfirst/crypto";

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

export class EncryptionLocalFirst implements Encryption {
  clefs: { publique: Base58; secrète: Base58 };
  nom = "local-first-auth";

  constructor() {
    const { publicKey, secretKey } = asymmetric.keyPair();
    this.clefs = { secrète: secretKey, publique: publicKey };
  }

  async obtClefs(): Promise<{ publique: Base58; secrète: Base58 }> {
    return this.clefs;
  }

  async encrypter({
    message,
    clefPubliqueDestinataire,
  }: {
    message: string;
    clefPubliqueDestinataire: string;
  }): Promise<string> {
    return asymmetric
      .encrypt({
        secret: message,
        recipientPublicKey: clefPubliqueDestinataire as Base58,
        senderSecretKey: this.clefs.secrète as Base58,
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
    return asymmetric.decrypt({
      cipher: message as Base58,
      recipientSecretKey: this.clefs.secrète as Base58,
      senderPublicKey: clefPubliqueExpéditeur as Base58,
    });
  }

  async clefAléatoire(n: number = 6): Promise<string> {
    return randomKey(n);
  }

  async obtNom(): Promise<string> {
    return this.nom;
  }
}
