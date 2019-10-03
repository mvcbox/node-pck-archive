import zlib from 'zlib';
import path from 'path';
import fs from 'fs-extra';
import { PW_KEY_1, PW_KEY_2 } from './constants';
import { FileReader } from 'file-reader-writer';
import { PwFileTableEntry } from './PwFileTableEntry';
import { PwPckReaderOptions } from './PwPckReaderOptions';

export class PwPckReader {
    public key1: number;
    public key2: number;
    public fr: FileReader;
    public filesCount: number = -1;
    public isLegasy: boolean = false;
    public fileTablePointer: number = -1;
    public fileTable: PwFileTableEntry[] = [];

    constructor(archive: number | string, options?: PwPckReaderOptions) {
        options = options || {};
        this.fr = new FileReader(archive);
        this.key1 = typeof options.key1 === 'number' ? options.key1 : PW_KEY_1;
        this.key2 = typeof options.key2 === 'number' ? options.key2 : PW_KEY_2;
    }

    public async init(): Promise<void> {
        await this.fr.init();
        this.filesCount = await this.fr.setPointer(this.fr.length - 8).readInt32LE();
        this.fileTablePointer = (await this.fr.setPointer(this.fr.length - 272).readUInt32LE()) ^ this.key1;
        return this.readFileTable();
    }

    public async destroy(): Promise<void> {
        return this.fr.destroy();
    }

    public async detectType(): Promise<void> {

    }

    public async readFileTable(): Promise<void> {
        this.fr.setPointer(this.fileTablePointer);
        this.fileTable = [];

        for (let i = 0; i < this.filesCount; ++i) {
            this.fr.offset(4);
            const entrySize = (await this.fr.readInt32LE()) ^ this.key2;
            const fileEntry = new PwFileTableEntry(await this.fr.read(entrySize));
            this.fileTable.push(fileEntry);
        }
    }

    public async readFile(file: PwFileTableEntry): Promise<Buffer> {
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
