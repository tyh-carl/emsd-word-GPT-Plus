# Full-Page Translation (English → Traditional Chinese)

## Step 1 — Read the Document Structure

Call `getDocumentStructure` to capture every paragraph's text and formatting:

- style, alignment
- font: name, size, bold, italic, underline, color
- leftIndent, firstLineIndent, lineSpacing, spaceBefore, spaceAfter
- isListItem, listLevel

Do not proceed until you have this data.

---

## Step 2 — Insert a Page Break

Call `appendText` with `newPage: true` and `text: " "`.

---

## Step 3 — Translate and Insert All Paragraphs

For every paragraph from Step 1 with non-empty text, translate to Traditional Chinese (繁體中文):

- Before translating, read the **Proper Noun List** at the bottom of this prompt. For every term that appears in column 1 (English abbreviation/name), use the corresponding Traditional Chinese translation in column 3. Do not translate or romanise terms that appear in the list — copy them exactly as specified.
- Keep codes, acronyms not in the list, and dates unchanged (e.g. "Ref. No.", "5 Feb 2026").
- Preserve punctuation structure (colons, dashes, brackets).

Then issue **all** `insertFormattedParagraph` calls in a **single response**, in paragraph order, each with:

| Parameter | Value |
|-----------|-------|
| `text` | translated text |
| `location` | `"End"` |
| `style` | original Word style (Heading1, Heading2, Title, Normal, etc.) |
| `fontName`, `fontSize`, `bold`, `italic`, `underline`, `fontColor` | match original |
| `alignment`, `leftIndent`, `firstLineIndent`, `lineSpacing`, `spaceBefore`, `spaceAfter` | match original |

> **List items:** set `leftIndent` by level — level 0 = 0 pt, level 1 = 36 pt, level 2 = 72 pt.

---

## Step 4 — Verify and Fix Formatting

Call `getDocumentStructure` again. The translated paragraphs are the **last N paragraphs** in the document, where N is the number of non-empty paragraphs inserted in Step 3.

For each translated paragraph, compare actual formatting against the Step 1 reference:

- **Font:** fontSize, bold, italic, underline, fontColor
- **Paragraph:** alignment, leftIndent, firstLineIndent, lineSpacing, spaceBefore, spaceAfter

For every mismatch:

1. Call `selectSpecificText` with the translated text (`occurrence: 1`).
2. In the **same response**, call `formatText` and/or `setParagraphFormat` to correct the mismatched fields.

Skip paragraphs where all fields already match.

---

## Step 5 — Confirm

Report:

- Total paragraphs inserted
- Number that required formatting corrections
- Any paragraph that was skipped or could not be fixed (with reason)

---

## Proper Noun List

```json
[
  ["EMSD", "機電工程署", "Electrical and Mechanical Services Department"],
  ["DTD", "Digitalization & Technology Division", "數碼科技部"]
]
```
