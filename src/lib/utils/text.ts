const namedEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

export function decodeHtmlEntities(input: string): string {
  if (!input) {
    return input
  }

  let output = input

  for (let pass = 0; pass < 2; pass += 1) {
    output = output.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        const codePoint = parseInt(entity.slice(2), 16)
        return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
      }

      if (entity.startsWith('#')) {
        const codePoint = parseInt(entity.slice(1), 10)
        return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
      }

      const replacement = namedEntities[entity]
      return replacement ?? match
    })
  }

  return output
}
