export enum PwPckType {
    UNDEFINED   = 0,
    // Legacy type. FileTableEntry size 272 bytes. No offset for copyright.
    TYPE_1      = 1,
    // New type. FileTableEntry size 276 bytes. 4 bytes offset for copyright.
    TYPE_2      = 2,
}
