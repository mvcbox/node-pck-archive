export type FileTableEntryOptions = Buffer | {
    path: string;
    dataOffset: number;
    dataDecompressedSize: number;
    dataCompressedSize: number;
};
