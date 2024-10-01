import resolve from '@rollup/plugin-node-resolve';
import terser from "@rollup/plugin-terser";
import { createFilter } from '@rollup/pluginutils';
import peggy from 'peggy';


class RollupPeggyWithSourceMap {
    name = 'rollup-plugin-peggy-with-source-map';
    transform(grammar, id) {
        const filter = createFilter(['*.peggy', '**/*.peggy'], []);
        if (!filter(id)) {
            return null;
        }
        const generated = peggy.generate(grammar, {
            allowedStartRules: ['TemplatedRoot', 'ExpressionRoot'],
            output: 'source-and-map',
            grammarSource: id,
            format: 'es',
            cache: true
        });
        const path = id.split("/");
        const res = generated.toStringWithSourceMap({});
        return {
            code: res.code,
            map: res.map.toString()
        };
    }
}

export default {
    input: 'src/index.mjs',
    output: [{
        sourcemap: true,
        file: 'dist/ftl.min.mjs',
        format: 'es',
        plugins: [
            terser()
        ]
    }, {
        sourcemap: true,
        file: 'dist/ftl.mjs',
        format: 'es'
    }, {
        sourcemap: true,
        file: 'dist/ftl.iife.min.js',
        name: 'ftl',
        format: 'iife',
        plugins: [
            terser()
        ]
    }, {
        sourcemap: true,
        file: 'dist/ftl.iife.js',
        name: 'ftl',
        format: 'iife'
    }],
    treeshake: true,
    plugins: [
        new RollupPeggyWithSourceMap(),
        resolve()
    ]
};
