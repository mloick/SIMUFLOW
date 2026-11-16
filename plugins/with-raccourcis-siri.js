// Plugin Expo : ajoute les raccourcis Siri (App Intents) à l'app iOS.
//
// Le dossier ios/ est généré par « npx expo prebuild » : on ne l'écrit pas à la
// main. Ce plugin fait les deux gestes qu'on ferait dans Xcode :
// 1. copier plugins/raccourcis-siri/Raccourcis.swift dans ios/<NomDuProjet>/ ;
// 2. ajouter ce fichier à la cible de l'app (pour qu'il soit compilé).
// Le code doit être dans l'app elle-même, et pas dans un module : c'est là
// qu'iOS va chercher les raccourcis.
const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const FICHIER = 'Raccourcis.swift';
const SOURCE = path.join(__dirname, 'raccourcis-siri', FICHIER);

function withCopieDuFichier(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const nomProjet = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
      const cible = path.join(config.modRequest.platformProjectRoot, nomProjet, FICHIER);
      fs.copyFileSync(SOURCE, cible);
      return config;
    },
  ]);
}

function withFichierDansXcode(config) {
  return withXcodeProject(config, (config) => {
    const nomProjet = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    const chemin = `${nomProjet}/${FICHIER}`;
    if (!config.modResults.hasFile(chemin)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: chemin,
        groupName: nomProjet,
        project: config.modResults,
      });
    }
    return config;
  });
}

module.exports = function withRaccourcisSiri(config) {
  return withFichierDansXcode(withCopieDuFichier(config));
};
