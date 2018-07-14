const { BABEL_ENV } = process.env

module.exports = {
  plugins: [
    BABEL_ENV !== 'es' && '@babel/plugin-transform-modules-commonjs',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-syntax-object-rest-spread',
  ].filter(Boolean),
}
