import JSZip from "jszip";
import { fileSave } from "browser-fs-access";
import path from "path";
import { isNode, isElectronMain } from "wherearewe";

export function traduire(
  trads: { [key: string]: string },
  langues: string[]
): string | undefined {
  const langueTrouvée = langues.find((l) => trads[l] !== undefined);
  const trad = langueTrouvée ? trads[langueTrouvée] : undefined;
  return trad;
}

export async function zipper(
  fichiersDocs: { nom: string; octets: Uint8Array }[],
  fichiersSFIP: { nom: string; octets: Uint8Array }[],
  nomFichier: string
): Promise<void> {
  if (!nomFichier.endsWith(".zip")) nomFichier = `${nomFichier}.zip`;

  const fichierZip = new JSZip();
  for (const doc of fichiersDocs) {
    fichierZip.file(doc.nom, doc.octets);
  }

  const dossierFichiersSFIP = fichierZip.folder("sfip")!;
  for (const fichier of fichiersSFIP) {
    dossierFichiersSFIP.file(fichier.nom, fichier.octets);
  }
  await sauvegarderFichierZip({ fichierZip, nomFichier });
}

export async function sauvegarderFichierZip({
  fichierZip,
  nomFichier,
}: {
  fichierZip: JSZip;
  nomFichier: string;
}): Promise<void> {
  if (isNode || isElectronMain) {
    const fs = await import("fs");

    const contenu = fichierZip.generateNodeStream();
    fs.mkdirSync(path.dirname(nomFichier), { recursive: true });
    const fluxÉcriture = fs.createWriteStream(nomFichier);
    const flux = contenu.pipe(fluxÉcriture);
    return new Promise((résoudre) => flux.on("finish", résoudre));
  } else {
    const contenu = await fichierZip.generateAsync({ type: "blob" });
    await fileSave(contenu, { fileName: nomFichier });
  }
}
