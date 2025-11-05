import { JSONSchemaType } from "ajv";
import { PartielRécursif, StatutDonnées, TraducsTexte } from "./types.js";

export const schémaTraducsTexte: JSONSchemaType<
  PartielRécursif<TraducsTexte>
> & { nullable: true } = {
  type: "object",
  additionalProperties: {
    type: "string",
  },
  nullable: true,
  required: [],
};

export const schémaStatutDonnées: JSONSchemaType<
  PartielRécursif<StatutDonnées>
> & { nullable: true } = {
  type: "object",
  properties: {
    statut: { type: "string", nullable: true },
    idNouvelle: { type: "string", nullable: true },
  },
  required: [],
  nullable: true,
};
