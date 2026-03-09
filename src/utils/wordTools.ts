import { tool } from '@langchain/core/tools'
import { z } from 'zod'

export type WordToolName =
  | 'getSelectedText'
  | 'getDocumentContent'
  | 'insertText'
  | 'replaceSelectedText'
  | 'appendText'
  | 'insertParagraph'
  | 'formatText'
  | 'searchAndReplace'
  | 'getDocumentProperties'
  | 'insertTable'
  | 'insertList'
  | 'deleteText'
  | 'clearFormatting'
  | 'setFontName'
  | 'insertPageBreak'
  | 'getRangeInfo'
  | 'selectText'
  | 'insertImage'
  | 'getTableInfo'
  | 'insertBookmark'
  | 'goToBookmark'
  | 'insertContentControl'
  | 'findText'
  | 'selectSpecificText'
  | 'getDocumentStructure'
  | 'setParagraphFormat'
  | 'setListFormat'
  | 'copyRangeOoxml'
  | 'pasteOoxml'

const wordToolDefinitions: Record<WordToolName, WordToolDefinition> = {
  getSelectedText: {
    name: 'getSelectedText',
    description:
      'Get the currently selected text in the Word document. Returns the selected text or empty string if nothing is selected.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return Word.run(async context => {
        const range = context.document.getSelection()
        range.load('text')
        await context.sync()
        return range.text || ''
      })
    },
  },

  getDocumentContent: {
    name: 'getDocumentContent',
    description: 'Get the full content of the Word document body as plain text.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return Word.run(async context => {
        const body = context.document.body
        body.load('text')
        await context.sync()
        return body.text || ''
      })
    },
  },

  insertText: {
    name: 'insertText',
    description: 'Insert text at the current cursor position in the Word document.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to insert',
        },
        location: {
          type: 'string',
          description: 'Where to insert: "Start", "End", "Before", "After", or "Replace"',
          enum: ['Start', 'End', 'Before', 'After', 'Replace'],
        },
      },
      required: ['text'],
    },
    execute: async args => {
      const { text, location = 'End' } = args
      return Word.run(async context => {
        const range = context.document.getSelection()
        range.insertText(text, location as Word.InsertLocation)
        await context.sync()
        return `Successfully inserted text at ${location}`
      })
    },
  },

  replaceSelectedText: {
    name: 'replaceSelectedText',
    description: 'Replace the currently selected text with new text.',
    inputSchema: {
      type: 'object',
      properties: {
        newText: {
          type: 'string',
          description: 'The new text to replace the selection with',
        },
      },
      required: ['newText'],
    },
    execute: async args => {
      const { newText } = args
      return Word.run(async context => {
        const range = context.document.getSelection()
        range.insertText(newText, 'Replace')
        await context.sync()
        return 'Successfully replaced selected text'
      })
    },
  },

  appendText: {
    name: 'appendText',
    description: 'Append text to the end of the document.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to append',
        },
        newPage: {
          type: 'boolean',
          description: 'Insert a page break before append the text',
        },
      },
      required: ['text'],
    },
    execute: async args => {
      const { text, newPage = false } = args
      return Word.run(async context => {
        const body = context.document.body
        if (newPage) body.insertBreak('Page', 'End')
        body.insertText(text, 'End')
        await context.sync()
        return 'Successfully appended text to document'
      })
    },
  },

  insertParagraph: {
    name: 'insertParagraph',
    description: 'Insert a new paragraph at the specified location.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The paragraph text',
        },
        location: {
          type: 'string',
          description:
            'Where to insert: "After" (after cursor/selection), "Before" (before cursor), "Start" (start of doc), or "End" (end of doc). Default is "After".',
          enum: ['After', 'Before', 'Start', 'End'],
        },
        style: {
          type: 'string',
          description: 'Optional Word built-in style: Normal, Heading1, Heading2, Heading3, Quote, etc.',
          enum: [
            'Normal',
            'Heading1',
            'Heading2',
            'Heading3',
            'Heading4',
            'Quote',
            'IntenseQuote',
            'Title',
            'Subtitle',
          ],
        },
      },
      required: ['text'],
    },
    execute: async args => {
      const { text, location = 'After', style } = args
      return Word.run(async context => {
        let paragraph
        if (location === 'Start' || location === 'End') {
          const body = context.document.body
          paragraph = body.insertParagraph(text, location)
        } else {
          const range = context.document.getSelection()
          paragraph = range.insertParagraph(text, location as 'After' | 'Before')
        }
        if (style) {
          paragraph.styleBuiltIn = style as Word.BuiltInStyleName
        }
        await context.sync()
        return `Successfully inserted paragraph at ${location}`
      })
    },
  },

  formatText: {
    name: 'formatText',
    description: 'Apply formatting to the currently selected text.',
    inputSchema: {
      type: 'object',
      properties: {
        bold: {
          type: 'boolean',
          description: 'Make text bold',
        },
        italic: {
          type: 'boolean',
          description: 'Make text italic',
        },
        underline: {
          type: 'boolean',
          description: 'Underline text',
        },
        fontSize: {
          type: 'number',
          description: 'Font size in points',
        },
        fontColor: {
          type: 'string',
          description: 'Font color as hex (e.g., "#FF0000" for red)',
        },
        highlightColor: {
          type: 'string',
          description:
            'Highlight color: Yellow, Green, Cyan, Pink, Blue, Red, DarkBlue, Teal, Lime, Purple, Orange, etc. Pass "None" to remove highlight.',
        },
      },
      required: [],
    },
    execute: async args => {
      const { bold, italic, underline, fontSize, fontColor, highlightColor } = args
      return Word.run(async context => {
        const range = context.document.getSelection()

        if (bold !== undefined) range.font.bold = bold
        if (italic !== undefined) range.font.italic = italic
        if (underline !== undefined) range.font.underline = underline ? 'Single' : 'None'
        if (fontSize !== undefined) range.font.size = fontSize
        if (fontColor !== undefined) range.font.color = fontColor
        if (highlightColor !== undefined) range.font.highlightColor = highlightColor === 'None' ? null : highlightColor
        await context.sync()
        return 'Successfully applied formatting'
      })
    },
  },

  searchAndReplace: {
    name: 'searchAndReplace',
    description: 'Search for text in the document and replace it with new text.',
    inputSchema: {
      type: 'object',
      properties: {
        searchText: {
          type: 'string',
          description: 'The text to search for',
        },
        replaceText: {
          type: 'string',
          description: 'The text to replace with',
        },
        matchCase: {
          type: 'boolean',
          description: 'Whether to match case (default: false)',
        },
        matchWholeWord: {
          type: 'boolean',
          description: 'Whether to match whole word only (default: false)',
        },
      },
      required: ['searchText', 'replaceText'],
    },
    execute: async args => {
      const { searchText, replaceText, matchCase = false, matchWholeWord = false } = args
      return Word.run(async context => {
        const body = context.document.body
        const searchResults = body.search(searchText, {
          matchCase,
          matchWholeWord,
        })
        searchResults.load('items')
        await context.sync()

        const count = searchResults.items.length
        for (const item of searchResults.items) {
          item.insertText(replaceText, 'Replace')
        }
        await context.sync()
        return `Replaced ${count} occurrence(s) of "${searchText}" with "${replaceText}"`
      })
    },
  },

  getDocumentProperties: {
    name: 'getDocumentProperties',
    description: 'Get document properties including paragraph count, word count, and character count.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return Word.run(async context => {
        const body = context.document.body
        body.load(['text'])

        const paragraphs = body.paragraphs
        paragraphs.load('items')

        await context.sync()

        const text = body.text || ''
        const wordCount = text.split(/\s+/).filter(word => word.length > 0).length
        const charCount = text.length
        const paragraphCount = paragraphs.items.length

        return JSON.stringify(
          {
            paragraphCount,
            wordCount,
            characterCount: charCount,
          },
          null,
          2,
        )
      })
    },
  },

  insertTable: {
    name: 'insertTable',
    description: 'Insert a table at the current cursor position.',
    inputSchema: {
      type: 'object',
      properties: {
        rows: {
          type: 'number',
          description: 'Number of rows',
        },
        columns: {
          type: 'number',
          description: 'Number of columns',
        },
        data: {
          type: 'array',
          description: 'Optional 2D array of cell values',
          items: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      required: ['rows', 'columns'],
    },
    execute: async args => {
      const { rows, columns, data } = args
      return Word.run(async context => {
        const range = context.document.getSelection()

        // Create table data
        const tableData: string[][] =
          data ||
          Array(rows)
            .fill(null)
            .map(() => Array(columns).fill(''))

        const table = range.insertTable(rows, columns, 'After', tableData)
        table.styleBuiltIn = 'GridTable1Light'

        await context.sync()
        return `Successfully inserted ${rows}x${columns} table`
      })
    },
  },

  insertList: {
    name: 'insertList',
    description:
      'Insert a bulleted or numbered list at the end of the document. Returns the list ID so you can attach more items later with setListFormat.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Array of list item texts',
          items: { type: 'string' },
        },
        listType: {
          type: 'string',
          description: 'Type of list: "bullet" for bulleted list, "number" for numbered list',
          enum: ['bullet', 'number'],
        },
        level: {
          type: 'number',
          description: 'List indentation level, 0-based (0 = top level, 1 = first sub-level). Default: 0',
        },
      },
      required: ['items', 'listType'],
    },
    execute: async args => {
      const { items, listType, level = 0 } = args
      return Word.run(async context => {
        if (!items || items.length === 0) return 'No items provided'

        const body = context.document.body

        // Insert first paragraph and start a real list
        const firstParagraph = body.insertParagraph(items[0], 'End')
        const list = firstParagraph.startNewList()
        await context.sync()

        firstParagraph.listItem.level = level
        list.load('id')
        await context.sync()

        const listId = list.id

        // Apply the correct numbering or bullet style
        if (listType === 'bullet') {
          list.setLevelBullet(level, 'Solid')
        } else {
          list.setLevelNumbering(level, 'Arabic', [level, '.'])
        }

        // Insert remaining items attached to the same list
        for (let i = 1; i < items.length; i++) {
          const paragraph = body.insertParagraph(items[i], 'End')
          paragraph.attachToList(listId, level)
        }

        await context.sync()
        return JSON.stringify({
          message: `Inserted ${listType} list with ${items.length} item(s) at level ${level}`,
          listId,
        })
      })
    },
  },

  deleteText: {
    name: 'deleteText',
    description:
      'Delete the currently selected text or a specific range. If no text is selected, this will delete at the cursor position.',
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          description: 'Direction to delete if nothing selected: "Before" (backspace) or "After" (delete key)',
          enum: ['Before', 'After'],
        },
      },
      required: [],
    },
    execute: async args => {
      const { direction = 'After' } = args
      return Word.run(async context => {
        const range = context.document.getSelection()
        range.load('text')
        await context.sync()

        if (range.text && range.text.length > 0) {
          range.delete()
        } else {
          if (direction === 'After') {
            range.insertText('', 'After')
          } else {
            range.insertText('', 'Before')
          }
        }
        await context.sync()
        return 'Successfully deleted text'
      })
    },
  },

  clearFormatting: {
    name: 'clearFormatting',
    description: 'Clear all formatting from the selected text, returning it to default style.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return Word.run(async context => {
        const range = context.document.getSelection()
        range.font.bold = false
        range.font.italic = false
        range.font.underline = 'None'
        range.styleBuiltIn = 'Normal'
        await context.sync()
        return 'Successfully cleared formatting'
      })
    },
  },

  setFontName: {
    name: 'setFontName',
    description: 'Set the font name/family for the selected text (e.g., Arial, Times New Roman, Calibri).',
    inputSchema: {
      type: 'object',
      properties: {
        fontName: {
          type: 'string',
          description: 'The font name to apply (e.g., "Arial", "Times New Roman", "Calibri", "Consolas")',
        },
      },
      required: ['fontName'],
    },
    execute: async args => {
      const { fontName } = args
      return Word.run(async context => {
        const range = context.document.getSelection()
        range.font.name = fontName
        await context.sync()
        return `Successfully set font to ${fontName}`
      })
    },
  },

  insertPageBreak: {
    name: 'insertPageBreak',
    description: 'Insert a page break at the current cursor position.',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Where to insert: "Before", "After", "Start", or "End"',
          enum: ['Before', 'After', 'Start', 'End'],
        },
      },
      required: [],
    },
    execute: async args => {
      const { location = 'After' } = args
      return Word.run(async context => {
        const range = context.document.getSelection()
        // insertBreak only supports Before and After for page breaks
        const insertLoc = location === 'Start' || location === 'Before' ? 'Before' : 'After'
        range.insertBreak('Page', insertLoc)
        await context.sync()
        return `Successfully inserted page break ${location.toLowerCase()}`
      })
    },
  },

  getRangeInfo: {
    name: 'getRangeInfo',
    description: 'Get detailed information about the current selection including text, formatting, and position.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return Word.run(async context => {
        const range = context.document.getSelection()
        range.load([
          'text',
          'style',
          'font/name',
          'font/size',
          'font/bold',
          'font/italic',
          'font/underline',
          'font/color',
        ])
        await context.sync()

        return JSON.stringify(
          {
            text: range.text || '',
            style: range.style,
            font: {
              name: range.font.name,
              size: range.font.size,
              bold: range.font.bold,
              italic: range.font.italic,
              underline: range.font.underline,
              color: range.font.color,
            },
          },
          null,
          2,
        )
      })
    },
  },

  selectText: {
    name: 'selectText',
    description: 'Select all text in the document or specific location.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: 'What to select: "All" for entire document',
          enum: ['All'],
        },
      },
      required: ['scope'],
    },
    execute: async args => {
      const { scope } = args
      return Word.run(async context => {
        if (scope === 'All') {
          const body = context.document.body
          body.select()
          await context.sync()
          return 'Successfully selected all text'
        }
        return 'Invalid scope'
      })
    },
  },

  insertImage: {
    name: 'insertImage',
    description: 'Insert an image from a URL at the current cursor position. The image URL must be accessible.',
    inputSchema: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          description: 'The URL of the image to insert',
        },
        width: {
          type: 'number',
          description: 'Optional width in points',
        },
        height: {
          type: 'number',
          description: 'Optional height in points',
        },
        location: {
          type: 'string',
          description: 'Where to insert: "Before", "After", "Start", "End", or "Replace"',
          enum: ['Before', 'After', 'Start', 'End', 'Replace'],
        },
      },
      required: ['imageUrl'],
    },
    execute: async args => {
      const { imageUrl, width, height, location = 'After' } = args
      return Word.run(async context => {
        const range = context.document.getSelection()
        const image = range.insertInlinePictureFromBase64(imageUrl, location as Word.InsertLocation)

        if (width) image.width = width
        if (height) image.height = height

        await context.sync()
        return `Successfully inserted image at ${location}`
      })
    },
  },

  getTableInfo: {
    name: 'getTableInfo',
    description: 'Get information about tables in the document, including row and column counts.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return Word.run(async context => {
        const tables = context.document.body.tables
        tables.load(['items'])
        await context.sync()

        const tableInfos = []
        for (let i = 0; i < tables.items.length; i++) {
          const table = tables.items[i]
          table.load(['rowCount', 'values'])
          await context.sync()

          const columnCount = table.values && table.values[0] ? table.values[0].length : 0

          tableInfos.push({
            index: i,
            rowCount: table.rowCount,
            columnCount,
          })
        }

        return JSON.stringify(
          {
            tableCount: tables.items.length,
            tables: tableInfos,
          },
          null,
          2,
        )
      })
    },
  },

  insertBookmark: {
    name: 'insertBookmark',
    description: 'Insert a bookmark at the current selection to mark a location in the document.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the bookmark (must be unique, no spaces allowed)',
        },
      },
      required: ['name'],
    },
    execute: async args => {
      const { name } = args
      return Word.run(async context => {
        const range = context.document.getSelection()

        const bookmarkName = name.replace(/\s+/g, '_')

        const contentControl = range.insertContentControl()
        contentControl.tag = `bookmark_${bookmarkName}`
        contentControl.title = bookmarkName
        contentControl.appearance = 'Tags'

        await context.sync()
        return `Successfully inserted bookmark: ${bookmarkName}`
      })
    },
  },

  goToBookmark: {
    name: 'goToBookmark',
    description: 'Navigate to a previously created bookmark in the document.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the bookmark to navigate to',
        },
      },
      required: ['name'],
    },
    execute: async args => {
      const { name } = args
      return Word.run(async context => {
        const bookmarkName = name.replace(/\s+/g, '_')
        const contentControls = context.document.contentControls
        contentControls.load(['items'])
        await context.sync()

        for (const cc of contentControls.items) {
          cc.load(['tag', 'title'])
          await context.sync()

          if (cc.tag === `bookmark_${bookmarkName}` || cc.title === bookmarkName) {
            cc.select()
            await context.sync()
            return `Successfully navigated to bookmark: ${bookmarkName}`
          }
        }

        return `Bookmark not found: ${bookmarkName}`
      })
    },
  },

  insertContentControl: {
    name: 'insertContentControl',
    description:
      'Insert a content control (a container for content) at the current selection. Useful for creating structured documents.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title of the content control',
        },
        tag: {
          type: 'string',
          description: 'Optional tag for programmatic identification',
        },
        appearance: {
          type: 'string',
          description: 'Visual appearance of the control',
          enum: ['BoundingBox', 'Tags', 'Hidden'],
        },
      },
      required: ['title'],
    },
    execute: async args => {
      const { title, tag, appearance = 'BoundingBox' } = args
      return Word.run(async context => {
        const range = context.document.getSelection()
        const contentControl = range.insertContentControl()
        contentControl.title = title
        if (tag) contentControl.tag = tag
        contentControl.appearance = appearance as Word.ContentControlAppearance

        await context.sync()
        return `Successfully inserted content control: ${title}`
      })
    },
  },

  findText: {
    name: 'findText',
    description: 'Find text in the document and return information about matches. Does not modify the document.',
    inputSchema: {
      type: 'object',
      properties: {
        searchText: {
          type: 'string',
          description: 'The text to search for',
        },
        matchCase: {
          type: 'boolean',
          description: 'Whether to match case (default: false)',
        },
        matchWholeWord: {
          type: 'boolean',
          description: 'Whether to match whole word only (default: false)',
        },
      },
      required: ['searchText'],
    },
    execute: async args => {
      const { searchText, matchCase = false, matchWholeWord = false } = args
      return Word.run(async context => {
        const body = context.document.body
        const searchResults = body.search(searchText, {
          matchCase,
          matchWholeWord,
        })
        searchResults.load(['items'])
        await context.sync()

        const count = searchResults.items.length
        return JSON.stringify(
          {
            searchText,
            matchCount: count,
            found: count > 0,
          },
          null,
          2,
        )
      })
    },
  },

  selectSpecificText: {
    name: 'selectSpecificText',
    description:
      'Search for specific text in the document and select it. Useful for selecting particular words or phrases before applying formatting, replacement, or other operations.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to search for and select',
        },
        occurrence: {
          type: 'number',
          description: 'Which occurrence to select (1-based). Default: 1 (first match)',
        },
        matchCase: {
          type: 'boolean',
          description: 'Whether to match case (default: false)',
        },
        matchWholeWord: {
          type: 'boolean',
          description: 'Whether to match whole word only (default: false)',
        },
      },
      required: ['text'],
    },
    execute: async args => {
      const { text, occurrence = 1, matchCase = false, matchWholeWord = false } = args
      return Word.run(async context => {
        const body = context.document.body
        const searchResults = body.search(text, { matchCase, matchWholeWord })
        searchResults.load('items')
        await context.sync()

        const count = searchResults.items.length
        if (count === 0) {
          return `Text "${text}" not found in document`
        }

        const index = Math.max(0, Math.min(occurrence - 1, count - 1))
        searchResults.items[index].select()
        await context.sync()

        return `Selected occurrence ${index + 1} of ${count} for "${text}"`
      })
    },
  },

  setListFormat: {
    name: 'setListFormat',
    description:
      'Apply list formatting to the currently selected paragraph(s). Can start a new list or attach to an existing one. ' +
      'Typical workflow: insertParagraph → selectSpecificText → setListFormat. ' +
      'When continuing an existing list pass the listId returned by a previous insertList or setListFormat call.',
    inputSchema: {
      type: 'object',
      properties: {
        listType: {
          type: 'string',
          description: 'Type of list: "bullet" for bulleted, "number" for numbered',
          enum: ['bullet', 'number'],
        },
        level: {
          type: 'number',
          description: 'List indentation level, 0-based (0 = top level). Default: 0',
        },
        listId: {
          type: 'number',
          description:
            'ID of an existing list to attach the paragraph to. Omit (or leave undefined) to start a brand-new list.',
        },
      },
      required: ['listType'],
    },
    execute: async args => {
      const { listType, level = 0, listId } = args
      return Word.run(async context => {
        const range = context.document.getSelection()
        const paragraphs = range.paragraphs
        paragraphs.load('items')
        await context.sync()

        if (paragraphs.items.length === 0) return 'No paragraphs selected'

        let activeListId: number | undefined = listId
        let activeList: Word.List | null = null

        for (let i = 0; i < paragraphs.items.length; i++) {
          const paragraph = paragraphs.items[i]

          if (activeListId !== undefined && activeListId !== null) {
            // Attach to an existing list
            paragraph.attachToList(activeListId, level)
          } else {
            // Start a new list from this paragraph
            activeList = paragraph.startNewList()
            await context.sync()

            paragraph.listItem.level = level
            activeList.load('id')
            await context.sync()

            activeListId = activeList.id

            // Apply the list style on the new list
            if (listType === 'bullet') {
              activeList.setLevelBullet(level, 'Solid')
            } else {
              activeList.setLevelNumbering(level, 'Arabic', [level, '.'])
            }
          }
        }

        await context.sync()
        return JSON.stringify({
          message: `Applied ${listType} list formatting at level ${level} to ${paragraphs.items.length} paragraph(s)`,
          listId: activeListId,
        })
      })
    },
  },

  getDocumentStructure: {
    name: 'getDocumentStructure',
    description:
      'Get the full document structure with rich formatting details for every paragraph: text content, Word style, alignment, font name/size/bold/italic/underline/color, indentation, line spacing, and whether it is a list item (with list level). Use this instead of getDocumentContent when you need to replicate or inspect formatting.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return Word.run(async context => {
        const body = context.document.body
        const paragraphs = body.paragraphs
        paragraphs.load('items')
        await context.sync()

        for (const p of paragraphs.items) {
          p.load([
            'text',
            'style',
            'alignment',
            'firstLineIndent',
            'leftIndent',
            'lineSpacing',
            'spaceBefore',
            'spaceAfter',
            'isListItem',
          ])
          p.font.load(['name', 'size', 'bold', 'italic', 'underline', 'color'])
        }
        await context.sync()

        // Second pass: load list level for list item paragraphs
        for (const p of paragraphs.items) {
          if (p.isListItem) {
            p.listItem.load('level')
          }
        }
        await context.sync()

        const result = paragraphs.items.map((p, index) => {
          const info: Record<string, any> = {
            index,
            text: p.text?.trim() ?? '',
            style: p.style,
            alignment: p.alignment,
            leftIndent: p.leftIndent,
            firstLineIndent: p.firstLineIndent,
            lineSpacing: p.lineSpacing,
            spaceBefore: p.spaceBefore,
            spaceAfter: p.spaceAfter,
            isListItem: p.isListItem,
            font: {
              name: p.font.name,
              size: p.font.size,
              bold: p.font.bold,
              italic: p.font.italic,
              underline: p.font.underline,
              color: p.font.color,
            },
          }
          if (p.isListItem) {
            info.listLevel = p.listItem.level
          }
          return info
        })

        return JSON.stringify(result, null, 2)
      })
    },
  },

  copyRangeOoxml: {
    name: 'copyRangeOoxml',
    description:
      'Read the currently selected range as raw OOXML (Office Open XML). ' +
      'Returns a string of OOXML that preserves ALL formatting: mixed bold/italic runs, tables, images, ' +
      'hyperlinks, numbering, etc. Store the returned string and pass it to pasteOoxml to replicate the content elsewhere. ' +
      'This is the equivalent of Ctrl+C in Word.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return Word.run(async context => {
        const range = context.document.getSelection()
        const ooxml = range.getOoxml()
        await context.sync()
        return ooxml.value
      })
    },
  },

  pasteOoxml: {
    name: 'pasteOoxml',
    description:
      'Insert raw OOXML (previously obtained from copyRangeOoxml) at the specified location. ' +
      'Preserves ALL original formatting exactly — equivalent to Ctrl+V in Word. ' +
      'Use location "End" to append after existing content, or "After"/"Before" relative to the current selection.',
    inputSchema: {
      type: 'object',
      properties: {
        ooxml: {
          type: 'string',
          description: 'The raw OOXML string returned by copyRangeOoxml',
        },
        location: {
          type: 'string',
          description: 'Where to insert: "Before", "After", "Start", "End", or "Replace". Default: "End"',
          enum: ['Before', 'After', 'Start', 'End', 'Replace'],
        },
      },
      required: ['ooxml'],
    },
    execute: async args => {
      const { ooxml, location = 'End' } = args
      return Word.run(async context => {
        if (location === 'Start' || location === 'End') {
          const body = context.document.body
          body.insertOoxml(ooxml, location as Word.InsertLocation)
        } else {
          const range = context.document.getSelection()
          range.insertOoxml(ooxml, location as Word.InsertLocation)
        }
        await context.sync()
        return `Successfully pasted OOXML content at ${location}`
      })
    },
  },

  setParagraphFormat: {
    name: 'setParagraphFormat',
    description:
      'Set paragraph-level formatting on the currently selected paragraph(s): alignment (left/centered/right/justified), line spacing, space before/after paragraph, and left/first-line indentation. Select text first with selectSpecificText, then call this tool to apply the format.',
    inputSchema: {
      type: 'object',
      properties: {
        alignment: {
          type: 'string',
          description: 'Paragraph alignment',
          enum: ['left', 'centered', 'right', 'justified'],
        },
        lineSpacing: {
          type: 'number',
          description: 'Line spacing in points (e.g. 12 for single-spaced at 12pt, 24 for double-spaced)',
        },
        spaceBefore: {
          type: 'number',
          description: 'Space before the paragraph in points',
        },
        spaceAfter: {
          type: 'number',
          description: 'Space after the paragraph in points',
        },
        leftIndent: {
          type: 'number',
          description: 'Left indentation in points',
        },
        firstLineIndent: {
          type: 'number',
          description: 'First-line indentation in points (use negative value for hanging indent)',
        },
      },
      required: [],
    },
    execute: async args => {
      const { alignment, lineSpacing, spaceBefore, spaceAfter, leftIndent, firstLineIndent } = args
      return Word.run(async context => {
        const range = context.document.getSelection()
        const paragraphs = range.paragraphs
        paragraphs.load('items')
        await context.sync()

        for (const p of paragraphs.items) {
          if (alignment !== undefined) p.alignment = alignment as Word.Alignment
          if (lineSpacing !== undefined) p.lineSpacing = lineSpacing
          if (spaceBefore !== undefined) p.spaceBefore = spaceBefore
          if (spaceAfter !== undefined) p.spaceAfter = spaceAfter
          if (leftIndent !== undefined) p.leftIndent = leftIndent
          if (firstLineIndent !== undefined) p.firstLineIndent = firstLineIndent
        }
        await context.sync()

        return `Successfully applied paragraph formatting to ${paragraphs.items.length} paragraph(s)`
      })
    },
  },
}

export function createWordTools(enabledTools?: WordToolName[]) {
  const tools = Object.entries(wordToolDefinitions)
    .filter(([name]) => !enabledTools || enabledTools.includes(name as WordToolName))
    .map(([, def]) => {
      const schemaObj: Record<string, z.ZodTypeAny> = {}

      for (const [propName, prop] of Object.entries(def.inputSchema.properties)) {
        let zodType: z.ZodTypeAny

        switch (prop.type) {
          case 'string':
            zodType = prop.enum ? z.enum(prop.enum as [string, ...string[]]) : z.string()
            break
          case 'number':
            zodType = z.number()
            break
          case 'boolean':
            zodType = z.boolean()
            break
          case 'array':
            zodType = z.array(z.any())
            break
          default:
            zodType = z.any()
        }

        if (prop.description) {
          zodType = zodType.describe(prop.description)
        }

        if (!def.inputSchema.required?.includes(propName)) {
          zodType = zodType.optional()
        }

        schemaObj[propName] = zodType
      }

      return tool(
        async input => {
          try {
            return await def.execute(input)
          } catch (error: any) {
            return `Error: ${error.message || 'Unknown error occurred'}`
          }
        },
        {
          name: def.name,
          description: def.description,
          schema: z.object(schemaObj),
        },
      )
    })

  return tools
}

export function getWordToolDefinitions(): WordToolDefinition[] {
  return Object.values(wordToolDefinitions)
}

export function getWordTool(name: WordToolName): WordToolDefinition | undefined {
  return wordToolDefinitions[name]
}

export { wordToolDefinitions }
