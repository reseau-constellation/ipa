import { isElectronMain, isNode } from "wherearewe";
import PQueue from "p-queue";
import { ServiceAppli } from "@/v2/nébuleuse/appli/appli.js";
import type { Appli } from "@/v2/nébuleuse/appli/appli.js";

export type OptionsServiceJournal = {
  f: string | ((m: string) => void | Promise<void>);
};

export class ServiceJournal extends ServiceAppli<
  "journal",
  { journal: ServiceJournal },
  { f: (m: string) => Promise<void> | void },
  OptionsServiceJournal
> {
  queue: PQueue;

  constructor({
    appli,
    options,
  }: {
    appli: Appli<{ journal: ServiceJournal }>;
    options?: OptionsServiceJournal;
  }) {
    super({
      clef: "journal",
      appli,
      options: options || { f: console.log },
    });

    this.queue = new PQueue({ concurrency: 1 });
  }

  async démarrer(): Promise<{ f: (m: string) => Promise<void> | void }> {
    const { f } = this.options;

    if (typeof f === "string") {
      if (!(isNode || isElectronMain)) throw new Error("");
      const fs = await import("fs");
      const path = await import("path");
      const dossier = path.dirname(f);

      if (!fs.existsSync(dossier)) {
        fs.mkdirSync(dossier);
      }
      this.estDémarré = {
        f: (m: string) =>
          this.queue.add(async () => await fs.promises.appendFile(f, m + "\n")),
      };
    } else {
      this.estDémarré = {
        f: (m: string) => this.queue.add(async () => await f(m + "\n")),
      };
    }

    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    await this.queue.onIdle();
    return await super.fermer();
  }

  async écrire(message: string): Promise<void> {
    const { f } = await this.démarré();
    return await f(message);
  }
}
