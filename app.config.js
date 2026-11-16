// baseUrl ne sert qu'au site web : dans une version Release native, Metro le
// met devant le chemin des images intégrées et la compilation échoue.
module.exports = ({ config }) => {
  if (process.env.SIMUFLOW_WEB) return config;
  const { baseUrl, ...experiments } = config.experiments;
  return { ...config, experiments };
};
