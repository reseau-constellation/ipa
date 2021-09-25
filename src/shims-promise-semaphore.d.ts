declare module "@chriscdn/promise-semaphore" {
  export default class Semaphore {
    static createInstance(n: number = 1): Semaphore;

    acquire(name: string): Promise<void>;
    release(name: string): void;
  }
}
