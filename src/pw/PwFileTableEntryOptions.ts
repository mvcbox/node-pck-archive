export type PwFileTableEntryOptions = Buffer | {
    path: string;
    dataOffset: number;
    dataDecompressedSize: number;
    dataCompressedSize: number;
    entrySize?: number;
};
