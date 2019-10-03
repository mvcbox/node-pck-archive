import glob from 'glob';
import zlib from 'zlib';
import path from 'path';
import fs from 'fs-extra';
import { FileWriter } from 'file-reader-writer';
import { PwFileTableEntry } from './PwFileTableEntry';
import { PwPckWriterOptions } from './PwPckWriterOptions';
import { PW_KEY_1, PW_KEY_2, PW_ASIG_1, PW_ASIG_2, PW_FSIG_1, PW_FSIG_2 } from './constants';

export class PwPckWriter {
    public key1: number;
    public key2: number;
    public fw: FileWriter;
    public source: string;

    public constructor(source: string, destination: string, options?: PwPckWriterOptions) {
        options = options || {};
        this.source = path.normalize(source);
        this.fw = new FileWriter(path.normalize(destination));
        this.key1 = typeof options.key1 === 'number' ? options.key1 : PW_KEY_1;
        this.key2 = typeof options.key2 === 'number' ? options.key2 : PW_KEY_2;
    }

    public async init(): Promise<void> {
        await this.fw.init();
    }

    public async destroy(): Promise<void> {
        return this.fw.destroy();
    }

    public async pack(level: number): Promise<void> {
        const files = glob.sync(`${this.source}/**/*`).map(path.normalize).filter(function (file) {
            return fs.statSync(file).isFile();
        });

        const fileTable: PwFileTableEntry[] = [];
        await this.fw.writeInt32LE(PW_FSIG_1);
        await this.fw.writeInt32LE(0);
        await this.fw.writeInt32LE(PW_FSIG_2);

        for (const file of files) {
            const entryPath = file.replace(this.source + path.sep, '').replace(/\//g, '\\');
            const entryDataOffset = this.fw.pointer;
            let data = fs.readFileSync(file);
            const entryDataDecompressedSize = data.length;
            let entryDataCompressedSize = data.length;
            const data2 = zlib.deflateSync(data, {
                level: level,
                memLevel: level
            });

            if (data2.length < data.length) {
                data = data2;
                entryDataCompressedSize = data.length;
            }

            await this.fw.write(data);

            fileTable.push(new PwFileTableEntry({
                path: entryPath,
                dataOffset: entryDataOffset,
                dataDecompressedSize: entryDataDecompressedSize,
                dataCompressedSize: entryDataCompressedSize
            }));
        }

        const fileTablePointer = this.fw.pointer;

        for (const fileEntry of fileTable) {
            const buffer = fileEntry.pack(level);
            await this.fw.writeInt32LE(buffer.length ^ this.key1);
            await this.fw.writeInt32LE(buffer.length ^ this.key2);
            await this.fw.write(buffer);
        }

        await this.fw.writeInt32LE(PW_ASIG_1);
        await this.fw.writeInt16LE(2);
        await this.fw.writeInt16LE(2);
        await this.fw.writeInt32LE(fileTablePointer ^ this.key1);

        const copyright = 'Angelica File Package, Perfect World.';
        const buffer = Buffer.alloc ? Buffer.alloc(256) : new Buffer(256);
        const string = Buffer.from ? Buffer.from(copyright, 'ascii') : new Buffer(copyright, 'ascii');
        string.copy(buffer);
        await this.fw.write(buffer);

        await this.fw.writeInt32LE(PW_ASIG_2);
        await this.fw.writeInt32LE(fileTable.length);
        await this.fw.writeInt16LE(2);
        await this.fw.writeInt16LE(2);
        this.fw.setPointer(4).writeUInt32LE(this.fw.length);

        return this.destroy();
    }
}
