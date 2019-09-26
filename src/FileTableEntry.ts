import zlib from 'zlib';
import iconv from 'iconv-lite';
import { FileTableEntryOptions } from './FileTableEntryOptions';

export class FileTableEntry {
    public path: string;
    public dataOffset: number;
    public dataDecompressedSize: number;
    public dataCompressedSize: number;

    public constructor(options: FileTableEntryOptions) {
        if (options instanceof Buffer) {
            if (options.length < 272) {
                options = zlib.unzipSync(options);
            }

            this.path = iconv.decode(options.slice(0, 260), 'gb2312').split('\0')[0];
            this.dataOffset = options.slice(260, 264).readUInt32LE(0);
            this.dataDecompressedSize = options.slice(264, 268).readInt32LE(0);
            this.dataCompressedSize = options.slice(268, 272).readInt32LE(0);
        } else {
            this.path = options.path;
            this.dataOffset = options.dataOffset;
            this.dataDecompressedSize = options.dataDecompressedSize;
            this.dataCompressedSize = options.dataCompressedSize;
        }
    }

    public pathSize(): number {
        return iconv.encode(this.path, 'gb2312').length;
    }

    public pathSizeIsValid(): boolean {
        return this.pathSize() <= 260;
    }

    public pack(level: number): Buffer {
        if (!this.pathSizeIsValid()) {
            throw new Error('Invalid path size!');
        }

        const buffer = Buffer.alloc ? Buffer.alloc(272) : new Buffer(272);
        iconv.encode(this.path, 'gb2312').copy(buffer, 0, 0, 260);
        buffer.writeUInt32LE(this.dataOffset, 260);
        buffer.writeInt32LE(this.dataDecompressedSize, 264);
        buffer.writeInt32LE(this.dataCompressedSize, 268);

        const buffer2 = zlib.gzipSync(buffer, {
            level: level,
            memLevel: level
        });

        return buffer2.length < 272 ? buffer2 : buffer;
    }
}
