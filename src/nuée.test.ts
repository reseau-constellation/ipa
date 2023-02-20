import { typesClients } from "@/utilsTests/client.js";

typesClients.forEach((type) => {
  describe.skip("Client " + type, function () {
    test.todo("Nuée");
  });
});

/*test("Les noms sont liés", async () => {
  const réfNomsLiés: { [key: string]: string } = Object.assign(
    {},
    réfNoms,
    { த: "பொழிவு" }
  );
  await client.bds!.sauvegarderNomBd({
    id: idBdCopieLiée,
    langue: "த",
    nom: "பொழிவு",
  });

  expect(nomsLiés).toEqual(réfNomsLiés);
  await client.bds!.sauvegarderNomBd({
    id: idBdOrig,
    langue: "fr",
    nom: "précipitation",
  });

  réfNomsLiés["fr"] = "précipitation";
  expect(nomsLiés).toEqual(réfNomsLiés);
});

test("Les descriptions sont liées", async () => {
  const réfDescrsLiées: { [key: string]: string } = Object.assign(
    {},
    réfNoms,
    { த: "தினசரி பொழிவு" }
  );
  await client.bds!.sauvegarderDescrBd({
    id: idBdCopieLiée,
    langue: "த",
    descr: "தினசரி பொழிவு",
  });

  expect(descrsLiées).toEqual(réfDescrsLiées);
  await client.bds!.sauvegarderDescrBd({
    id: idBdOrig,
    langue: "fr",
    descr: "Précipitation journalière",
  });

  réfDescrsLiées["fr"] = "précipitation";
  expect(descrsLiées).toEqual(réfDescrsLiées);
});

test.todo("Changement de tableaux détecté");
test.todo("Changement de colonnes tableau détecté");
test.todo("Changement propriétés de colonnes tableau détecté");
test.todo("Changement de règles détecté");
*/
