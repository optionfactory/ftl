import resolve from '@rollup/plugin-node-resolve';
import { terser } from "rollup-plugin-terser";

export default {
    input: 'src/index.mjs',
    output: [{
        sourcemap: true,
        file: 'dist/ftl.min.mjs',
        format: 'es',
        plugins: [
            terser()
        ]
    },{
        sourcemap: true,
        file: 'dist/ftl.mjs',
        format: 'es'
    },{
        sourcemap: true,
        file: 'dist/ftl.iife.min.js',
        name: 'ftl',
        format: 'iife',
        plugins: [
            terser()
        ]
    },{
        sourcemap: true,
        file: 'dist/ftl.iife.js',
        name: 'ftl',
        format: 'iife'
    }],
    treeshake: true,
    plugins: [
        resolve()        
    ]
};
