import { Encryption, EncryptionLocalFirst } from "@/encryption.js";

import { expect } from "aegir/chai";
import { typesClients } from "./ressources/utils.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Encryption", function () {
      let encrypteur1: Encryption;
      let encrypteur2: Encryption;
      let encrypteur3: Encryption;

      before(async () => {
        encrypteur1 = new EncryptionLocalFirst();
        encrypteur2 = new EncryptionLocalFirst();
        encrypteur3 = new EncryptionLocalFirst();
      });

      it("Encrypter et décrypter", async () => {
        const clefs2 = await encrypteur2.obtClefs();

        const messageSecret = "போய்து வறேன்";
        const messageEncrypté = await encrypteur1.encrypter({
          message: messageSecret,
          clefPubliqueDestinataire: clefs2.publique,
        });

        const clefs1 = await encrypteur1.obtClefs();

        const messageDécrypté = await encrypteur2.décrypter({
          message: messageEncrypté,
          clefPubliqueExpéditeur: clefs1.publique,
        });

        expect(messageDécrypté).to.equal(messageSecret);
      });

      it("Quelqu'un d'autre ne peut pas décrypter", async () => {
        const clefs1 = await encrypteur1.obtClefs();
        const clefs2 = await encrypteur2.obtClefs();

        const messageSecret = "போய்து வறேன்";
        const messageEncrypté = await encrypteur1.encrypter({
          message: messageSecret,
          clefPubliqueDestinataire: clefs2.publique,
        });

        expect(
          encrypteur3.décrypter({
            message: messageEncrypté,
            clefPubliqueExpéditeur: clefs1.publique,
          }),
        ).to.be.rejected();
      });
    });
  });
});
