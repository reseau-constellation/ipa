declare module "@orbitdb/core" {
    export type OrbitDB = {
        id: string,
        open,
        stop,
        ipfs,
        directory,
        keystore,
        identity,
        peerId
      }
    export function createOrbitDB (args: {
        ipfs: IPFS,
        directory: string,

    }): Promise<OrbitDB>;

    export function useAccessController(accessController: AccessController): void;
    export function isValidAddress(address: unknown): boolean;
};
