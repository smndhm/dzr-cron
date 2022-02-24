module.exports = {
	env: {
		es2021: true,
		node: true,
	},
	extends: 'eslint:recommended',
	parserOptions: {
		ecmaVersion: 'latest',
	},
	rules: {
		indent: ['error', 'tab'],
		'linebreak-style': ['error', 'unix'],
		quotes: ['error', 'single'],
		semi: ['error', 'always'],
	},
	overrides: [
		{
			files: ['**/*.spec.js'],
			env: {
				jest: true,
			},
		},
	],
};
