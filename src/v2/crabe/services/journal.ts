import { isElectronMain, isNode } from "wherearewe";
import PQueue from "p-queue";
import { Nébuleuse, ServiceNébuleuse } from "@/v2/nébuleuse/nébuleuse.js";

export type OptionsServiceJournal = {
  f: string | ((m: string) => void | Promise<void>);
};

export class ServiceJournal extends ServiceNébuleuse<
  "stockage",
  { journal: ServiceJournal },
  { f: (m: string) => Promise<void> | void },
  OptionsServiceJournal
> {
  queue: PQueue;

  constructor({
    nébuleuse,
    options,
  }: {
    nébuleuse: Nébuleuse<{ journal: ServiceJournal }>;
    options?: OptionsServiceJournal;
  }) {
    super({
      clef: "stockage",
      nébuleuse,
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
