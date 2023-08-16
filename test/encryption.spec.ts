import { Encryption, EncryptionLocalFirst } from "@/encryption.js";
import { client as utilsClientTest } from "@constl/utils-tests";
const { typesClients } = utilsClientTest;

import { expect } from "aegir/chai";

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
        const messageSecret = "போய்து வறேன்";
        const messageEncrypté = encrypteur1.encrypter({
          message: messageSecret,
          clefPubliqueDestinataire: encrypteur2.clefs.publique,
        });

        const messageDécrypté = encrypteur2.décrypter({
          message: messageEncrypté,
          clefPubliqueExpéditeur: encrypteur1.clefs.publique,
        });

        expect(messageDécrypté).to.equal(messageSecret);
      });

      it("Quelqu'un d'autre ne peut pas décrypter", async () => {
        const messageSecret = "போய்து வறேன்";
        const messageEncrypté = encrypteur1.encrypter({
          message: messageSecret,
          clefPubliqueDestinataire: encrypteur2.clefs.publique,
        });

        expect(() =>
          encrypteur3.décrypter({
            message: messageEncrypté,
            clefPubliqueExpéditeur: encrypteur1.clefs.publique,
          })
        ).to.throw();
      });
    });
  });
});
