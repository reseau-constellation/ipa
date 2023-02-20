import { typesClients } from "@/utilsTests/client.js";

typesClients.forEach((type) => {
  describe.skip("Client " + type, function () {
    test.todo("Nuée");
  });
});
