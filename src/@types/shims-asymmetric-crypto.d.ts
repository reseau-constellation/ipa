declare module "asymmetric-crypto" {
  export function keyPair(): { secretKey: string; publicKey: string };
  export function fromSecretKey(secretKey: string): {
    secretKey: string;
    publicKey: string;
  };
  export function encrypt(
    data: string,
    recipientPublicKey: string,
    senderSecretKey: string
  ): {
    data: string;
    nonce: string;
  };
  export function decrypt(
    data: string,
    nonce: string,
    senderPublicKey: string,
    recipientSecretKey: string
  ): string;
  export function sign(message: string, secretKey: string): string;
  export function verify(
    message: string,
    signature: string,
    senderPublicKey: string
  ): boolean;
}
