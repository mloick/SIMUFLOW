import ExpoModulesCore
import ImageIO
import UIKit
import Vision

/// Lecture du texte d'une photo, entièrement sur le téléphone, avec Vision.
///
/// `recognizeTextAsync(uri)` renvoie une ligne par morceau de texte trouvé :
/// le texte, la confiance (de 0 à 1) et sa boîte, en fraction de l'image
/// (origine en haut à gauche, comme à l'écran).
public class TextRecognitionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TextRecognition")

    // Une AsyncFunction tourne hors du fil de l'interface : Vision, lent sur une
    // grande photo, ne bloque pas l'app.
    AsyncFunction("recognizeTextAsync") { (uri: URL) throws -> [[String: Any]] in
      try Self.recognize(uri)
    }
  }

  private static func recognize(_ uri: URL) throws -> [[String: Any]] {
    guard let image = UIImage(contentsOfFile: uri.path), let cgImage = image.cgImage else {
      throw ImageNotReadableException(uri.path)
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["fr-FR", "en-US"]

    // La photo garde son sens dans ses métadonnées : Vision doit le connaître pour lire droit.
    let handler = VNImageRequestHandler(
      cgImage: cgImage,
      orientation: CGImagePropertyOrientation(image.imageOrientation),
      options: [:]
    )
    try handler.perform([request])

    return (request.results ?? []).compactMap { observation in
      guard let candidate = observation.topCandidates(1).first else {
        return nil
      }
      // Vision compte depuis le bas de l'image ; l'app, depuis le haut.
      let box = observation.boundingBox
      return [
        "text": candidate.string,
        "confidence": Double(candidate.confidence),
        "x": Double(box.minX),
        "y": Double(1 - box.maxY),
        "width": Double(box.width),
        "height": Double(box.height),
      ]
    }
  }
}

final class ImageNotReadableException: GenericException<String> {
  override var reason: String {
    "La photo n'a pas pu être lue (\(param))."
  }
}

extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
