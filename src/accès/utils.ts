import type générerContrôleurConstellation from "./cntrlConstellation.js";
import { nomType } from "./cntrlConstellation.js";

export const pathJoin = (...paths: string[]) =>
  paths.join("/").replace(/((?<=\/)\/+)|(^\.\/)|((?<=\/)\.\/)/g, "") || ".";

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

export const estUnContrôleurConstellation = (
  x: unknown,
): x is ContrôleurConstellation => {
  return (x as ContrôleurConstellation).type === nomType;
};
