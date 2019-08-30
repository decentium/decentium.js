import pkg from './package.json'
import typescript from 'rollup-plugin-typescript2'

export default {
	input: 'src/index.ts',
	output: [
		{
			file: pkg.main,
			format: 'cjs'
		},
		{
			file: pkg.module,
			format: 'esm'
		},
	],
	external: Object.keys(pkg.dependencies),
	plugins: [
		typescript(),
	]
}
