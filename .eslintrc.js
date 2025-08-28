module.exports = {
    env: {
        es2022: true,
        mocha: true,
        node: true
    },

    parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'script'
    },

    rules: {
        indent: ['error', 4],
        'no-param-reassign': 'off',
        'class-methods-use-this': 'off',
        'no-underscore-dangle': 'off',

        // Allow function declarations at the bottom of a file. They are hoisted in ES6.
        'no-use-before-define': ['error', { functions: false }],

        // named funcs in stacktrace
        'func-names': ['error', 'as-needed'],

        'function-call-argument-newline': ['error', 'consistent'],
        'function-paren-newline': ['error', 'consistent'],

        // only set strict mode when necessary
        'strict': ['error', 'global'],

        'max-len': ['error', 120, 2, {
            ignoreUrls: true,
            ignoreComments: false,
            ignoreRegExpLiterals: true,
            ignoreStrings: true,
            ignoreTemplateLiterals: true
        }]
    }
};
