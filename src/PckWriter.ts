import glob from 'glob';
import zlib from 'zlib';
import path from 'path';
import fs from 'fs-extra';
import { PckReader } from './PckReader';
import { FileWriter } from 'file-reader-writer';
import { FileTableEntry } from './FileTableEntry';
import { PckWriterOptions } from './PckWriterOptions';
import { KEY_1, KEY_2, ASIG_1, ASIG_2, FSIG_1, FSIG_2 } from './constants';
import {PckReaderOptions} from "./PckReaderOptions";

export class PckWriter {
    public key1: number;
    public key2: number;
    public fw: FileWriter;
    public source: string;
    public destination: string;

    public constructor(source: string, destination: string, options?: PckReaderOptions) {
        this.source = path.normalize(source);
        this.destination = path.normalize(destination);
        options = options || {};
        this.key1 = typeof options.key1 === 'number' ? options.key1 : KEY_1;
        this.key2 = typeof options.key2 === 'number' ? options.key2 : KEY_2;
    }

    public async init(): Promise<void> {
        this.fw = new FileWriter(this.destination);
        await this.fw.init();
    }

    public async destroy(): Promise<void> {
        return this.fw.destroy();
    }

    public async pack(level: number): Promise<void> {
        const files = glob.sync(`${this.source}/**/*`).map(path.normalize).filter(function (file) {
            return fs.statSync(file).isFile();
        });

        const fileTable: FileTableEntry[] = [];
        await this.fw.writeInt32LE(FSIG_1);
        await this.fw.writeInt32LE(0);
        await this.fw.writeInt32LE(FSIG_2);

        for (const file of files) {
            const entryPath = file.replace(this.source + path.sep, '').replace(/\//g, '\\');
            const entryDataOffset = this.fw.pointer;
            let data = fs.readFileSync(file);
            const entryDataDecompressedSize = data.length;
            let entryDataCompressedSize = data.length;
            const data2 = zlib.gzipSync(data, {
                level: level,
                memLevel: level
            });

            if (data2.length < data.length) {
                data = data2;
                entryDataCompressedSize = data.length;
            }

            await this.fw.write(data);

            fileTable.push(new FileTableEntry({
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
            await this.fw.writeInt32LE(0);
        }

        await this.fw.writeInt32LE(ASIG_1);
        await this.fw.writeInt16LE(2);
        await this.fw.writeInt16LE(2);
        await this.fw.writeInt32LE(fileTablePointer ^ KEY_1);
        await this.fw.writeInt32LE(0);
        await this.fw.writeString('Angelica File Package, Perfect World.', 'ascii');
        const nuller = Buffer.alloc ? Buffer.alloc(215) : new Buffer(215);
        await this.fw.write(nuller);
        await this.fw.writeInt32LE(ASIG_2);
        await this.fw.writeInt32LE(fileTable.length);
        await this.fw.writeInt16LE(2);
        await this.fw.writeInt16LE(2);
        this.fw.setPointer(4).writeUInt32LE(this.fw.length);

        return this.destroy();
    }
}
