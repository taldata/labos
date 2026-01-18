import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default [
    // Ignore patterns
    {
        ignores: ['dist/**', 'node_modules/**', '*.config.js'],
    },

    // Base recommended rules
    js.configs.recommended,

    // React configuration
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            // React recommended rules
            ...react.configs.recommended.rules,
            ...react.configs['jsx-runtime'].rules,

            // React Hooks rules
            ...reactHooks.configs.recommended.rules,

            // React Refresh rules
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],

            // Disable prop-types since we're using React 19
            'react/prop-types': 'off',

            // Allow unused vars with underscore prefix
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
        },
    },
]
