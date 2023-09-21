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

    export function Database (args: {
        ipfs: IPFS,
        identity?: Identity,
        address: string,
        name?: string,
        access?: AccessController,
        directory?: string,
        meta?: object,
        headsStorage?: Storage,
        entryStorage?: Storage,
        indexStorage?: Storage,
        referencesCount?: number,
        syncAutomatically?: boolean,
        onUpdate?: () => void,
    }): Promise<{
        addOperation: (args: { op: string, key: string | null, value: any }) => Promise<string>;
        log: Log;
    }>;
    export type Identity = {
        id: string,
        publicKey: object,
        sigantures: object,
        type: string,
        sign: () => string,
        verify: () => boolean,
    };
    export class AccessController {};
};
