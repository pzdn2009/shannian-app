import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write(Data("Usage: swift extract_event_poster.swift poster.png\n".utf8))
    exit(2)
}

let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let image = NSImage(contentsOf: imageURL),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write(Data("Unable to read image\n".utf8))
    exit(2)
}

let textRequest = VNRecognizeTextRequest()
textRequest.recognitionLevel = .accurate
textRequest.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
textRequest.usesLanguageCorrection = true

let barcodeRequest = VNDetectBarcodesRequest()
barcodeRequest.symbologies = [.qr]

try VNImageRequestHandler(cgImage: cgImage).perform([textRequest, barcodeRequest])

let text = (textRequest.results ?? []).compactMap { observation -> [String: Any]? in
    guard let candidate = observation.topCandidates(1).first else { return nil }
    let box = observation.boundingBox
    return [
        "text": candidate.string,
        "confidence": candidate.confidence,
        "box": ["x": box.origin.x, "y": box.origin.y, "width": box.width, "height": box.height]
    ]
}

let qrCodes = (barcodeRequest.results ?? []).compactMap { observation -> [String: Any]? in
    guard let payload = observation.payloadStringValue else { return nil }
    let box = observation.boundingBox
    return [
        "payload": payload,
        "box": ["x": box.origin.x, "y": box.origin.y, "width": box.width, "height": box.height]
    ]
}

let result: [String: Any] = [
    "source": imageURL.lastPathComponent,
    "width": cgImage.width,
    "height": cgImage.height,
    "recognizedText": text,
    "qrCodes": qrCodes
]

let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
