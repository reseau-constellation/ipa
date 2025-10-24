import { JSONSchemaType } from "ajv";
import { PartielRécursif, StatutDonnées, TraducsTexte } from "./types.js";

export const schémaTraducsTexte: JSONSchemaType<
  PartielRécursif<TraducsTexte>
> & { $ref: string } = {
  $ref: "traducs-texts",
  type: "object",
  additionalProperties: {
    type: "string",
  },
  nullable: true,
  required: [],
};

export const schémaStatutDonnées: JSONSchemaType<
  PartielRécursif<StatutDonnées>
> & { $ref: string } = {
  $ref: "statut-données",
  type: "object",
  properties: {
    statut: { type: "string", nullable: true },
    idNouvelle: { type: "string", nullable: true },
  },
  required: [],
  nullable: true,
};
