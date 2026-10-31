// Seiten eines PDFs: Text je Seite (Modus „text“) oder eine Seite als JPEG (Modus „bild“).
import Foundation
import PDFKit
import AppKit
let a = CommandLine.arguments
guard a.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: a[2])) else { fputs("Aufruf: text|bild <pdf> [seite breite ziel]\n", stderr); exit(2) }
if a[1] == "text" {
  for i in 0..<doc.pageCount { let s = (doc.page(at: i)?.string ?? "").replacingOccurrences(of: "\n", with: " "); print("\(i + 1)\t\(s.prefix(160))") }
} else {
  let nr = Int(a[3])! - 1, breite = CGFloat(Double(a[4])!), ziel = a[5]
  guard let p = doc.page(at: nr) else { exit(3) }
  let box = p.bounds(for: .mediaBox); let f = breite / box.width
  let bild = p.thumbnail(of: NSSize(width: box.width * f, height: box.height * f), for: .mediaBox)
  guard let tiff = bild.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let jpg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.82]) else { exit(4) }
  try! jpg.write(to: URL(fileURLWithPath: ziel))
}
