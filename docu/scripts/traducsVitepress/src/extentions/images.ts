import fs from "fs";
import path from "path";

import { Extention } from "./extention.js";

export class ExtentionImages extends Extention {
    dossierImages: string;

    exts = ["png", "jpg", "jpeg"];

    constructor({dossierImages}:{dossierImages: string}){
        super()
        this.dossierImages = dossierImages
    }
    async extraireMessages({ }: { }): Promise<{ clef: string; valeur: string; }[]> {
        return [];
    }
    async compiler({ contenu, fichier, langue, }: { 
        contenu: Buffer; 
        traducs: { [clef: string]: string; }; 
        fichier: string; langue: string; 
    }): Promise<string | NodeJS.ArrayBufferView> {
        const fichierImageTraduite = path.join(this.dossierImages, langue, fichier);

        if (fs.existsSync(fichierImageTraduite)) {
            const contenuTraduit = fs.readFileSync(fichierImageTraduite);
            return contenuTraduit;
        }
        return contenu;
    }

}