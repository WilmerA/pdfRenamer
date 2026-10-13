const CONTRACT_PATTERNS = [
  // Contrato de Concesión No. 4448A
  // Contrato de Concesión No. FLV-10V
  /contrato\s+de\s+concesi[oó]n\s+(?:no\.?|n[º°]?\.?)\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)/i,

  // CONTRATO DE CONCESIÓN (L 685) ECC-082
  /contrato\s+de\s+concesi[oó]n\s+\([^)]*\)\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)/i,
];

export const extractContractNumber = (
  text: string,
): string | null => {
  for (const pattern of CONTRACT_PATTERNS) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
};


// const examples = [
//   "Contrato de Concesión No. 4448A (Ley 685 de 2001).",
//   "CONTRATO DE CONCESIÓN (L 685) ECC-082",
//   "Contrato de Concesión No. FLV-10V (L 685)",
// ];

// for (const example of examples) {
//   console.log({
//     input: example,
//     result: extractContractNumber(example),
//   });
// }