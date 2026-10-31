import CoreImage
import ExpoModulesCore
import ImageIO
import UIKit
import Vision

/// Lecture du texte d'une photo, entièrement sur le téléphone, avec Vision.
///
/// `recognizeTextAsync(uri)` cherche d'abord le document dans la photo (feuille,
/// écran, tableau) ; s'il le trouve, il le découpe et le redresse, comme
/// l'appareil photo de l'iPhone. Puis il lit le texte de ce qui reste.
///
/// Il renvoie `lines`, une ligne par morceau de texte trouvé (le texte, la
/// confiance de 0 à 1 et sa boîte, en fraction de l'image lue, origine en haut
/// à gauche comme à l'écran), et `uri`, l'image recadrée, si la photo l'a été.
public class TextRecognitionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TextRecognition")

    // Une AsyncFunction tourne hors du fil de l'interface : Vision, lent sur une
    // grande photo, ne bloque pas l'app.
    AsyncFunction("recognizeTextAsync") { (uri: URL) throws -> [String: Any] in
      try Self.recognize(uri)
    }
  }

  private static let context = CIContext()

  private static func recognize(_ uri: URL) throws -> [String: Any] {
    guard let image = UIImage(contentsOfFile: uri.path), let cgImage = image.cgImage else {
      throw ImageNotReadableException(uri.path)
    }

    // La photo garde son sens dans ses métadonnées : on la remet droite avant tout.
    let upright = CIImage(cgImage: cgImage).oriented(CGImagePropertyOrientation(image.imageOrientation))
    // Le recadrage est un plus : s'il échoue, on lit la photo entière.
    let document = try? findDocument(in: upright)
    let page = document ?? upright
    guard let pageImage = context.createCGImage(page, from: page.extent) else {
      throw ImageNotReadableException(uri.path)
    }

    var result: [String: Any] = ["lines": try readText(in: pageImage)]
    if document != nil, let saved = save(pageImage) {
      result["uri"] = saved.absoluteString
    }
    return result
  }

  /// Le document de la photo, découpé et redressé ; nil s'il n'y en a pas, ou s'il prend déjà toute la photo.
  private static func findDocument(in image: CIImage) throws -> CIImage? {
    let request = VNDetectDocumentSegmentationRequest()
    try VNImageRequestHandler(ciImage: image, options: [:]).perform([request])
    guard let found = request.results?.first, found.confidence >= 0.5 else {
      return nil
    }
    let area = found.boundingBox.width * found.boundingBox.height
    guard area > 0.15, area < 0.9 else {
      return nil
    }

    // Les coins sont en fraction de l'image, origine en bas à gauche, comme Core Image.
    let extent = image.extent
    func corner(_ point: CGPoint) -> CIVector {
      CIVector(x: extent.minX + point.x * extent.width, y: extent.minY + point.y * extent.height)
    }
    let straight = image.applyingFilter(
      "CIPerspectiveCorrection",
      parameters: [
        "inputTopLeft": corner(found.topLeft),
        "inputTopRight": corner(found.topRight),
        "inputBottomLeft": corner(found.bottomLeft),
        "inputBottomRight": corner(found.bottomRight),
      ]
    )
    return straight.transformed(by: CGAffineTransform(translationX: -straight.extent.minX, y: -straight.extent.minY))
  }

  /// L'image recadrée, enregistrée dans le cache de l'app pour être affichée.
  private static func save(_ image: CGImage) -> URL? {
    guard let data = UIImage(cgImage: image).jpegData(compressionQuality: 0.85) else {
      return nil
    }
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("scan-\(UUID().uuidString).jpg")
    do {
      try data.write(to: url)
      return url
    } catch {
      return nil
    }
  }

  private static func readText(in image: CGImage) throws -> [[String: Any]] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["fr-FR", "en-US"]
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])

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
