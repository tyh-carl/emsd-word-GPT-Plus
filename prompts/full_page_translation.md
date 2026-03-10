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

- Before translating, read the **Proper Noun List** at the bottom of this prompt. For every term that appears in column
  1 (English abbreviation/name), use the corresponding Traditional Chinese translation in column 3. Do not translate or
  romanise terms that appear in the list — copy them exactly as specified.
- Keep codes, acronyms not in the list, and dates unchanged (e.g. "Ref. No.", "5 Feb 2026").
- Preserve punctuation structure (colons, dashes, brackets).

Then issue **all** `insertFormattedParagraph` calls in a **single response**, in paragraph order, each with:

| Parameter                                                                                | Value                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `text`                                                                                   | translated text                                               |
| `location`                                                                               | `"End"`                                                       |
| `style`                                                                                  | original Word style (Heading1, Heading2, Title, Normal, etc.) |
| `fontName`, `fontSize`, `bold`, `italic`, `underline`, `fontColor`                       | match original                                                |
| `alignment`, `leftIndent`, `firstLineIndent`, `lineSpacing`, `spaceBefore`, `spaceAfter` | match Original                                                |

- **List items:** set `leftIndent` by level — level 0 = 0 pt, level 1 = 36 pt, level 2 = 72 pt.

---

## Step 4 — Confirm

Report the total number of paragraphs inserted and any that were skipped (with reason).

---

## Proper Noun List

```json
[
  ["EMSD", "機電工程署", "Electrical and Mechanical Services Department"],
  ["DTD", "Digitalization & Technology Division", "數碼科技部"]
]
```
