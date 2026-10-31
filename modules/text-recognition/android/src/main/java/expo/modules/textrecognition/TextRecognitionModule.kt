package expo.modules.textrecognition

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Lecture du texte d'une photo, entièrement sur le téléphone, avec ML Kit.
 *
 * `recognizeTextAsync(uri)` renvoie `lines` : un morceau de texte par cellule
 * (le texte, la confiance de 0 à 1 et sa boîte, en fraction de l'image, origine
 * en haut à gauche), comme le module iOS. Pas de recadrage sur Android : l'app
 * retrouve le tableau seule, grâce à sa ligne de titres.
 */
class TextRecognitionModule : Module() {
  private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

  override fun definition() = ModuleDefinition {
    Name("TextRecognition")

    AsyncFunction("recognizeTextAsync") { uri: String, promise: Promise ->
      val bitmap = try {
        loadUpright(uri)
      } catch (error: Exception) {
        null
      }
      if (bitmap == null) {
        promise.reject(ImageNotReadableException(uri))
        return@AsyncFunction
      }
      recognizer.process(InputImage.fromBitmap(bitmap, 0))
        .addOnSuccessListener { text ->
          promise.resolve(mapOf("lines" to pieces(text, bitmap.width, bitmap.height)))
        }
        .addOnFailureListener { error ->
          promise.reject(TextNotReadException(error))
        }
    }
  }

  /** La photo, réduite à 2 500 pixels au plus et remise droite d'après son EXIF. */
  private fun loadUpright(uri: String): Bitmap? {
    val path = Uri.parse(uri).path ?: return null
    val file = File(path)
    if (!file.exists()) return null

    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > MAX_SIZE) sample *= 2
    val bitmap = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null

    val degrees = when (ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (degrees == 0f) return bitmap
    val matrix = Matrix().apply { postRotate(degrees) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }

  /**
   * ML Kit peut lire toute une ligne de tableau d'un seul tenant. On la recoupe
   * là où deux mots sont séparés par un grand blanc (plus d'une fois et demie la
   * hauteur du texte) : chaque morceau correspond alors à une cellule.
   */
  private fun pieces(text: Text, width: Int, height: Int): List<Map<String, Any>> {
    val result = mutableListOf<Map<String, Any>>()
    for (block in text.textBlocks) {
      for (line in block.lines) {
        val lineBox = line.boundingBox ?: continue
        val gap = 1.5f * lineBox.height()
        var words = mutableListOf<Text.Element>()
        fun flush() {
          val boxes = words.mapNotNull { it.boundingBox }
          if (boxes.isNotEmpty()) {
            val left = boxes.minOf { it.left }
            val top = boxes.minOf { it.top }
            val right = boxes.maxOf { it.right }
            val bottom = boxes.maxOf { it.bottom }
            result.add(
              mapOf(
                "text" to words.joinToString(" ") { it.text },
                "confidence" to line.confidence.toDouble(),
                "x" to left.toDouble() / width,
                "y" to top.toDouble() / height,
                "width" to (right - left).toDouble() / width,
                "height" to (bottom - top).toDouble() / height,
              )
            )
          }
          words = mutableListOf()
        }
        for (word in line.elements) {
          val box = word.boundingBox
          val previous = words.lastOrNull()?.boundingBox
          if (box != null && previous != null && box.left - previous.right > gap) flush()
          words.add(word)
        }
        flush()
      }
    }
    return result
  }

  companion object {
    private const val MAX_SIZE = 2500
  }
}

class ImageNotReadableException(uri: String) :
  CodedException("La photo n'a pas pu être lue ($uri).")

class TextNotReadException(cause: Throwable) :
  CodedException("Le texte n'a pas pu être lu.", cause)
