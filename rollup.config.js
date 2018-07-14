import babel from 'rollup-plugin-babel'

const config = {
  output: {
    file: 'little-saga.js',
    format: 'cjs',
  },
  plugins: [babel({})],
}

export default config
