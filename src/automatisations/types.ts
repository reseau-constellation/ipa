import type { PartielRécursif } from "@constl/interface";
import type { JSONSchemaType } from "ajv";
import type { SpécificationAutomatisation } from "@constl/interface/automatisations";

// Types service

export type StructureServiceAutomatisations = {
  [id: string]: SpécificationAutomatisation;
};

export const schémaSpécificationAutomatisation: JSONSchemaType<SpécificationAutomatisation> =
  {
    type: "object",
    anyOf: [
      {
        type: "object",
        properties: {
          type: { type: "string" },
          id: { type: "string" },
          fréquence: {
            type: "object",
            properties: {
              type: { type: "string" },
              détails: {
                type: "object",
                properties: {
                  n: { type: "number" },
                  unités: { type: "string" },
                },
                nullable: true,
              },
            },
          },
          idObjet: { type: "string" },
          typeObjet: { type: "string" },
          formatDoc: { type: "string" },
          dossier: { type: "string", nullable: true },
          langues: {
            type: "array",
            items: {
              type: "string",
            },
            nullable: true,
          },
          dispositifs: {
            type: "array",
            items: { type: "string" },
          },
          inclureDocuments: {
            type: "boolean",
          },
          nRésultatsDésirésNuée: {
            type: "integer",
            nullable: true,
          },
        },
        required: [
          "type",
          "idObjet",
          "typeObjet",
          "formatDoc",
          "dispositifs",
          "fréquence",
          "inclureDocuments",
        ],
      },
      {
        type: "object",
        properties: {
          id: { type: "string" },
          fréquence: {
            type: "object",
            properties: {
              type: { type: "string" },
              détails: {
                type: "object",
                properties: {
                  n: { type: "number" },
                  unités: { type: "string" },
                },
                nullable: true,
              },
            },
          },
          idTableau: { type: "string" },
          dispositif: { type: "string" },
          source: {
            type: "object",
            properties: {
              type: { type: "string" },
              adresseFichier: { type: "string", nullable: true },
              info: {
                type: "object",
                additionalProperties: true,
                required: [],
              },
            },
            required: ["info", "type"],
          },
          conversions: {
            type: "array",
            nullable: true,
          },
        },
        required: ["id", "idTableau", "dispositif", "source"],
      },
    ],
    required: ["id", "type"],
  };

export const schémaServiceAutomatisations: JSONSchemaType<
  PartielRécursif<StructureServiceAutomatisations>
> & { nullable: true } = {
  type: "object",
  additionalProperties: {
    type: "object",
    anyOf: [
      {
        type: "object",
        properties: {
          type: { type: "string" },
          id: { type: "string" },
          fréquence: {
            type: "object",
            properties: {
              type: { type: "string" },
              détails: {
                type: "object",
                properties: {
                  n: { type: "number" },
                  unités: { type: "string" },
                },
                nullable: true,
              },
            },
          },
          idObjet: { type: "string" },
          typeObjet: { type: "string" },
          formatDoc: { type: "string" },
          dossier: { type: "string", nullable: true },
          langues: {
            type: "array",
            items: {
              type: "string",
            },
            nullable: true,
          },
          dispositifs: {
            type: "array",
            items: { type: "string" },
          },
          inclureDocuments: {
            type: "boolean",
          },
          nRésultatsDésirésNuée: {
            type: "integer",
            nullable: true,
          },
        },
        required: [],
      },
      {
        type: "object",
        properties: {
          id: { type: "string" },
          fréquence: {
            type: "object",
            properties: {
              type: { type: "string" },
              détails: {
                type: "object",
                properties: {
                  n: { type: "number" },
                  unités: { type: "string" },
                },
                nullable: true,
              },
            },
          },
          idTableau: { type: "string" },
          dispositif: { type: "string" },
          source: {
            type: "object",
            properties: {
              type: { type: "string" },
              adresseFichier: { type: "string", nullable: true },
              info: {
                type: "object",
                additionalProperties: true,
                required: [],
              },
            },
            required: [],
          },
          conversions: {
            type: "object",
            nullable: true,
            additionalProperties: true,
            required: [],
          },
        },
        required: [],
      },
    ],
    required: [],
  },
  required: [],
  nullable: true,
};
