module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Migrations do Drizzle importam arquivos .sql como string.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
