import { asymmetric, randomKey } from "@herbcaudill/crypto"

export interface Encryption {
  clefs : { publique: string, secrète: string};
  nom: string;

  encrypter(
    message: string,
    clefPubliqueDestinataire: string
  ): string

  décrypter(
    message: string,
    clefPubliqueExpéditeur: string,
  ): string

  clefAléatoire(): string
}

export class EncryptionHerbCaudill implements Encryption {
  clefs : { publique: string, secrète: string};
  nom = "herbcaudill";

  constructor() {
    const { publicKey, secretKey } = asymmetric.keyPair();
    this.clefs = { publique: publicKey, secrète: secretKey };
  }

  encrypter(
    message: string,
    clefPubliqueDestinataire: string
  ): string {
    return asymmetric.encrypt({
      secret: message,
      recipientPublicKey: clefPubliqueDestinataire,
      senderSecretKey: this.clefs.secrète,
    });
  }

  décrypter(
    message: string,
    clefPubliqueExpéditeur: string,
  ): string {
    return asymmetric.decrypt({
      cipher: message,
      senderPublicKey: clefPubliqueExpéditeur,
      recipientSecretKey: this.clefs.secrète,
    });
  }

  clefAléatoire(): string {
    return randomKey();
  }
}
