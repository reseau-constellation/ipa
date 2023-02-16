import { Encryption, EncryptionLocalFirst } from "@/encryption.js";

import { typesClients } from "@/utilsTests/index.js";
import { config } from "@/utilsTests/sfip.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Encryption", function () {
      let encrypteur1: Encryption;
      let encrypteur2: Encryption;
      let encrypteur3: Encryption;

      beforeAll(async () => {
        encrypteur1 = new EncryptionLocalFirst();
        encrypteur2 = new EncryptionLocalFirst();
        encrypteur3 = new EncryptionLocalFirst();
      }, config.patienceInit);

      test("Encrypter et décrypter", async () => {
        const messageSecret = "போய்து வறேன்";
        const messageEncrypté = encrypteur1.encrypter({
          message: messageSecret,
          clefPubliqueDestinataire: encrypteur2.clefs.publique,
        });

        const messageDécrypté = encrypteur2.décrypter({
          message: messageEncrypté,
          clefPubliqueExpéditeur: encrypteur1.clefs.publique,
        });

        expect(messageDécrypté).toEqual(messageSecret);
      });

      test("Quelqu'un d'autre ne peut pas décrypter", async () => {
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
        ).toThrow();
      });
    });
  });
});
