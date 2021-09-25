import { CID } from "multiformats/cid";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import fs from "fs";
import path from "path";

export function cidValide(cid: unknown): boolean {
  if (typeof cid === "string") {
    try {
      CID.parse(cid);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

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

  if (typeof window === "undefined") {
    const contenu = await fichierZip.generateAsync({ type: "arraybuffer" });
    fs.mkdirSync(path.dirname(nomFichier), { recursive: true });

    await fs.promises.writeFile(nomFichier, Buffer.from(contenu), "binary");
  } else {
    const contenu = await fichierZip.generateAsync({ type: "blob" });
    saveAs(contenu, nomFichier);
  }
}
