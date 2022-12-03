import { typesClients } from "@/utilsTests/index.js";

typesClients.forEach((type) => {
  describe.skip("Client " + type, function () {
    test.todo("Nuée");
  });
});
