module.exports = {
    preset: 'ts-jest',
    globals: {
        'ts-jest': {
            diagnostics: false,
            tsConfig: 'tsconfig.json',
        },
    },
    browser: false,
    testPathIgnorePatterns: ['/node_modules/', 'test/', 'build/', 'workers/']
};
