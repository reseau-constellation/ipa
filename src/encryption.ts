import { keyPair, encrypt, decrypt } from "asymmetric-crypto";
import { generateEntropy } from "@it-tools/bip39";

export interface Encryption {
  clefs: { publique: string; secrète: string };
  nom: string;

  encrypter({message, clefPubliqueDestinataire}: {message: string, clefPubliqueDestinataire: string}): string;

  décrypter({message, clefPubliqueExpéditeur }: {message: string, clefPubliqueExpéditeur: string}): string;

  clefAléatoire(): string;
}

export class EncryptionParDéfaut implements Encryption {
  clefs: { publique: string; secrète: string };
  nom = "défaut";

  constructor() {
    const { publicKey, secretKey } = keyPair();
    this.clefs = { publique: publicKey, secrète: secretKey };
  }

  encrypter({message, clefPubliqueDestinataire}: {message: string, clefPubliqueDestinataire: string}): string {
    return encrypt(
      message,
      clefPubliqueDestinataire,
      this.clefs.secrète
    ).toString();
  }

  décrypter({message, clefPubliqueExpéditeur}: {message: string, clefPubliqueExpéditeur: string}): string {
    const { data, nonce } = JSON.parse(message);
    return decrypt(data, nonce, clefPubliqueExpéditeur, this.clefs.secrète);
  }

  clefAléatoire(): string {
    return generateEntropy();
  }
}
