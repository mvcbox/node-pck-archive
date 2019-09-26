import zlib from 'zlib';
import path from 'path';
import fs from 'fs-extra';
import { KEY_1, KEY_2 } from './constants';
import { FileReader } from 'file-reader-writer';
import { FileTableEntry } from './FileTableEntry';
import { PckReaderOptions } from './PckReaderOptions';

export class PckReader {
    public key1: number;
    public key2: number;
    public fr: FileReader;
    public filesCount: number = 0;
    public archive: number | string;
    public fileTablePointer: number = 0;
    public fileTable: FileTableEntry[] = [];

    constructor(archive: number | string, options?: PckReaderOptions) {
        this.archive = archive;
        options = options || {};
        this.key1 = typeof options.key1 === 'number' ? options.key1 : KEY_1;
        this.key2 = typeof options.key2 === 'number' ? options.key2 : KEY_2;
    }

    public async init(): Promise<void> {
        this.fr = new FileReader(this.archive);
        await this.fr.init();
        this.filesCount = await this.fr.setPointer(this.fr.length - 8).readInt32LE();
        this.fileTablePointer = (await this.fr.setPointer(this.fr.length - 272).readInt32LE()) ^ this.key1;
        return this.readFileTable();
    }

    public async destroy(): Promise<void> {
        return this.fr.destroy();
    }

    public async readFileTable(): Promise<void> {
        this.fr.setPointer(this.fileTablePointer);
        this.fileTable = [];

        for (let i = 0; i < this.filesCount; ++i) {
            this.fr.offset(4);
            const entrySize = (await this.fr.readInt32LE()) ^ this.key2;
            this.fileTable.push(new FileTableEntry(await this.fr.read(entrySize)));
        }
    }

    public async readFile(file: FileTableEntry): Promise<Buffer> {
        const data = await this.fr.setPointer(file.dataOffset).read(file.dataCompressedSize);

        if (file.dataCompressedSize !== file.dataDecompressedSize) {
            return zlib.unzipSync(data);
        }

        return data;
    }

    public async extract(_path: string): Promise<void> {
        await fs.ensureDir(_path);

        for (const file of this.fileTable) {
            const data = await this.readFile(file);
            const fullPath = `${_path}/${file.path.replace(/\\/g, path.sep)}`;
            await fs.ensureDir(path.dirname(fullPath));
            fs.writeFileSync(fullPath, data);
        }
    }
}
