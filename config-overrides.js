module.exports = function override(config, env) {
  // do stuff with the webpack config...
  config.module.rules.push({
    test: /\.worker\.(js|ts)$/,
    use: { loader: 'worker-loader' },
  });
  config.output.globalObject = 'self';
  return config;
};
