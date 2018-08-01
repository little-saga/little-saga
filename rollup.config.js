import babel from 'rollup-plugin-babel'

export default [
  // TODO 需要指定目录
  {
    input: 'src/index.js',
    output: {
      file: 'dist/little-saga.js',
      format: 'cjs',
    },
    plugins: [babel({})],
  },
  {
    input: 'src/index.js',
    output: {
      file: 'dist/little-saga.es.js',
      format: 'es',
    },
    plugins: [babel({})],
  },
]
