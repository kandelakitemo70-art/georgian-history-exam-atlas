// Manual corrections for the tests parser (things the PDFs encode ambiguously).
export default {
  // line-end hyphen decisions: 'word-part' -> true keeps the hyphen, false joins the parts
  hyphen: { 'ერთ-ერთ': true, 'ერთ-ერთი': true, 'დემო-კრატებისგან': false, 'შვილი-შვილსა': false },
  // per test: kinds {taskNumber: kind}, points {taskNumber: n}, text replacements etc.
  tests: {
    '2024-4': { scheme: [[/^28\.7\./, '38.7.']] },   // typo in the official scheme ("28.7." for 38.7.)
  },
};
