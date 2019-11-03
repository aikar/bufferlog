export const INDEX_HEADER_SPEC = {
    VERSION: 0, // 8 bit
    CURRENT_GENERATION: 1, // 24bit
    FIRST_INDEX: 4, // 32bit
    LAST_INDEX: 8, // 32bit
    LOG_COUNT: 12, // 32bit
    _UNUSED: 16,
};
export const INDEX_RECORD_SPEC = {
    LOG_FILE: 0, // 32bit
    GENERATION: 4, // 32bit
    FIRST_TIMESTAMP: 8, // 32bit
    LAST_TIMESTAMP: 12, // 32bit
    FIRST_OFFSET: 16, // 32bit
    LAST_OFFSET: 20, // 32bit
    _UNUSED: 24, // 32bit
};
export const RECORD_SIZE = 32;
export const HEADER_SIZE = 256;