// Raccourcis Siri de SimuFlow (App Intents, iOS 18 et plus).
//
// Ce fichier est copié dans le projet iOS par le plugin
// plugins/with-raccourcis-siri.js au moment de « npx expo prebuild ».
// Il n'a pas besoin de compte Apple payant : un raccourci d'app (App Shortcut)
// n'utilise ni l'option Siri ni aucun droit spécial.
//
// Principe : Siri ou l'app Raccourcis lance l'action « Ouvrir un écran de
// SimuFlow ». L'action ouvre simplement le lien simuflow://<écran>, et
// Expo Router affiche l'écran correspondant, comme pour n'importe quel lien.

import AppIntents
import Foundation

/// Les écrans que l'on peut ouvrir avec un raccourci (les onglets de l'app).
@available(iOS 18.0, *)
enum EcranSimuFlow: String, AppEnum {
  case process
  case scanner
  case projets

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Écran"

  static let caseDisplayRepresentations: [EcranSimuFlow: DisplayRepresentation] = [
    .process: "Process",
    .scanner: "Scanner",
    .projets: "Projets",
  ]

  /// Le chemin Expo Router de l'écran : « » = onglet Process (src/app/(tabs)/index.tsx).
  var chemin: String {
    switch self {
    case .process: return ""
    case .scanner: return "scanner"
    case .projets: return "projets"
    }
  }
}

/// L'action elle-même : ouvrir SimuFlow sur l'écran choisi.
@available(iOS 18.0, *)
struct OuvrirEcranIntent: AppIntent {
  static let title: LocalizedStringResource = "Ouvrir un écran de SimuFlow"
  static let description = IntentDescription("Ouvre SimuFlow sur l’écran choisi : Process, Scanner ou Projets.")

  @Parameter(title: "Écran", default: .process)
  var ecran: EcranSimuFlow

  static var parameterSummary: some ParameterSummary {
    Summary("Ouvrir \(\.$ecran)")
  }

  func perform() async throws -> some IntentResult & OpensIntent {
    // Le système ouvre le lien comme un lien tapé dans Safari : il lance l'app
    // si elle était fermée, puis Expo Router lit le lien.
    let lien = URL(string: "simuflow://\(ecran.chemin)")!
    return .result(opensIntent: OpenURLIntent(lien))
  }
}

/// Les phrases que Siri reconnaît. Chaque phrase doit contenir le nom de l'app.
/// Les raccourcis apparaissent aussi tout seuls dans l'app Raccourcis et dans
/// la recherche Spotlight, sans réglage.
@available(iOS 18.0, *)
struct RaccourcisSimuFlow: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: OuvrirEcranIntent(),
      phrases: [
        "Ouvrir \(\.$ecran) dans \(.applicationName)",
        "Ouvre \(\.$ecran) dans \(.applicationName)",
        "Montre \(\.$ecran) dans \(.applicationName)",
        "Ouvrir \(.applicationName)",
      ],
      shortTitle: "Ouvrir un écran",
      systemImageName: "arrow.triangle.branch"
    )
  }
}
