// Run: typst compile scripts/measure-line-metrics.typ scripts/measure-line-metrics.pdf
// Prints Libertinus Serif 11pt metrics (Typst’s model: baseline step ≈ text-height + leading).
#set text(font: "Libertinus Serif", size: 11pt)

#context {
  let th = measure(text[A]).height / 11pt
  let base = measure(box[
    #set par(leading: 0em)
    A \
    A
  ]).height / 11pt
  let with-leading = measure(box[
    #set par(leading: 0.65em)
    A \
    A
  ]).height / 11pt
  let per-line = with-leading - base
  let para-two = measure(box[
    #set par(leading: 0.65em, spacing: 0.65em)
    A
    #parbreak()
    A
  ]).height / 11pt
  [
    *Libertinus Serif 11pt*\
    text-height: #{calc.round(th, digits: 4)} em\
    per-line increment at leading 0.65: #{calc.round(per-line, digits: 4)} em\
    text-height + 0.65: #{calc.round(th + 0.65, digits: 4)} em\
    two paragraphs (spacing=leading=0.65): #{calc.round(para-two, digits: 4)} em total\
    extra over one line pair: #{calc.round(para-two - with-leading, digits: 4)} em\
  ]
}
