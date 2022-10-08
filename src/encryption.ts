import { asymmetric } from "@localfirst/auth"

export interface Encryption {
  clefs: { publique: string; secrète: string };
  nom: string;

  encrypter({
    message,
    clefPubliqueDestinataire,
  }: {
    message: string;
    clefPubliqueDestinataire: string;
  }): string;

  décrypter({
    message,
    clefPubliqueExpéditeur,
  }: {
    message: string;
    clefPubliqueExpéditeur: string;
  }): string;

  clefAléatoire(): string;
}

export class EncryptionLocalFirst implements Encryption {
  clefs: { publique: string; secrète: string };
  nom = "défaut";

  constructor() {
    const { publicKey, secretKey } = asymmetric.keyPair();
    this.clefs = { publique: publicKey, secrète: secretKey };
  }

  encrypter({
    message,
    clefPubliqueDestinataire,
  }: {
    message: string;
    clefPubliqueDestinataire: string;
  }): string {
    return asymmetric
      .encrypt({
        secret: message,
        recipientPublicKey: clefPubliqueDestinataire,
        senderSecretKey: this.clefs.secrète,
      })
      .toString();
  }

  décrypter({
    message,
    clefPubliqueExpéditeur,
  }: {
    message: string;
    clefPubliqueExpéditeur: string;
  }): string {
    return asymmetric.decrypt({
      cipher: message,
      recipientSecretKey: this.clefs.secrète,
      senderPublicKey: clefPubliqueExpéditeur,
    });
  }

  clefAléatoire(): string {
    return Math.random().toString(); //randomKey();
  }
}
