import resolve from '@rollup/plugin-node-resolve';
import { terser } from "rollup-plugin-terser";
import { createFilter } from '@rollup/pluginutils';
import { generate } from 'peggy';


class RollupPeggyWithSourceMap {
    name = 'rollup-plugin-peggy-with-source-map';
    transform(grammar, id) {
        const filter = createFilter(['*.peggy', '**/*.peggy'], []);
        if (!filter(id)) {
            return null;
        }
        console.log("generating", id);
        const generated = generate(grammar, {
            output: 'source-and-map',
            grammarSource: id,
            format: 'es'
        });
        const path = id.split("/");
        const res = generated.toStringWithSourceMap({});
        console.log(res.map);
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
