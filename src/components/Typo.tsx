import { Fragment, type ReactNode } from 'react';

/**
 * Newsreader has no subscript-two glyph (U+2082), so "O₂" in serif text falls back to a full-size 2.
 * In Newsreader contexts, render the ₂ as a sized <sub> using Newsreader's own "2". Sans and mono contexts don't need this.
 */
export function sub2(text: string | null | undefined): ReactNode {
  if (!text) return text ?? '';
  if (!text.includes('₂')) return text;
  return text.split('₂').map((part, i) =>
    i === 0 ? (
      part
    ) : (
      <Fragment key={i}>
        <sub className="sub2">2</sub>
        {part}
      </Fragment>
    ),
  );
}

/** "O₂" for serif headings. */
export function O2() {
  return (
    <>
      O<sub className="sub2">2</sub>
    </>
  );
}
