local function merge_tables(...)
  local result = {}
  for _, tbl in ipairs({ ... }) do
    for k, v in pairs(tbl) do
      result[k] = v
    end
  end
  return result
end

local hl = function(group, ...)
  local styles = merge_tables(...)
  vim.api.nvim_set_hl(0, group, styles)
end

local setup = function()
  vim.api.nvim_command("hi clear")
  if vim.fn.exists("syntax_on") then
    vim.api.nvim_command("syntax reset")
  end

  vim.o.termguicolors = true
  vim.o.background = "light"
  vim.g.colors_name = "z4p5a9"

  local colors = {
    white = "#ffffff",

    black = "#424242",
    blackStrong = "#000000",
    blackSubtle = "#b7b7b8",

    red = "#eb0000",
    redDim = "#b80000",
    redSoft = "#ffe6e2",

    orange = "#f89200",
    orangeDim = "#b56f00",
    orangeSoft = "#fff0d1",

    green = "#008a00",
    greenDim = "#006b2a",
    greenSoft = "#e6f6ea",

    hue = "#eb0000",
    hueStrong = "#8f0000",
  }

  local semantic = {
    bg = colors.white,
    fg = colors.black,
    fgInverted = colors.white,
    keyword = colors.blackStrong,
    comment = colors.blackSubtle,
    type = colors.hue,
    tag = colors.hueStrong,
    cursor = "#ff2600",
    cursorLine = "#fff0ed",
    visual = "#ffe3de",
    highlight = "#ffd83d",
    success = "",
    warning = "",
    error = "",
    directory = colors.hueStrong,
  }

  local hlGroup = {
    normal = { fg = semantic.fg, bg = semantic.bg },
    text = { fg = semantic.fg },
    comment = { fg = semantic.comment, italic = true },
    keyword = { fg = semantic.keyword, bold = true },
    value = { fg = colors.hue },
    operator = { fg = semantic.fg },
    delimiter = { fg = semantic.fg },
    member = { fg = semantic.fg },
    property = { fg = semantic.fg },
    fun = { fg = semantic.fg },
    type = { fg = semantic.type },
    namespace = { fg = colors.blackStrong },

    search = { bg = semantic.highlight },

    tag = { fg = semantic.tag },

    cursor = { fg = semantic.fgInverted, bg = semantic.cursor },
    cursorLine = { bg = semantic.cursorLine },
    visual = { bg = semantic.visual },

    statusLine = { fg = colors.black, bg = "#f7f3f2" },
    statusLineNC = { fg = colors.blackSubtle, bg = colors.white },

    directory = { fg = semantic.directory },
  }

  -- hl('@apz.indent_blankline_char', colors.text)
  -- hl('GitSignsAdd', { fg = 'green', bold = true })
  -- hl('GitSignsAdd', { fg = 'green', bold = true })
  -- hl('GitSignsAdd', { fg = 'green', bold = true })
  -- hl('ApzNormal', { fg = '#ffffff', bg = '#ffffff' })
  -- vim.cmd [[hi ApzNormal guifg=black guibg=white]]
  -- vim.cmd [[hi! link Normal ApzNormal]]

  -- vim.g.terminal_color_0 = '#ffffff'
  -- vim.g.terminal_color_1 = colors.red
  -- vim.g.terminal_color_2 = colors.green
  -- vim.g.terminal_color_3 = colors.yellowDark
  -- vim.g.terminal_color_4 = colors.blue
  -- vim.g.terminal_color_5 = colors.purple
  -- vim.g.terminal_color_6 = colors.blueLight
  -- vim.g.terminal_color_7 = colors.fg
  -- vim.g.terminal_color_8 = colors.fgInactive
  -- vim.g.terminal_color_9 = colors.redDark
  -- vim.g.terminal_color_10 = colors.orangeLight
  -- vim.g.terminal_color_11 = colors.orange
  -- vim.g.terminal_color_12 = colors.symbol
  -- vim.g.terminal_color_13 = colors.red
  -- vim.g.terminal_color_14 = colors.orangeLight
  -- vim.g.terminal_color_15 = colors.comment
  -- vim.g.terminal_color_background = '#ffffff'
  -- vim.g.terminal_color_foreground = '#ffffff'

  -- hl('NonText', { link = 'Normal' })
  -- hl('Terminal', { link = 'Normal' })
  --
  -- General
  hl("Normal", hlGroup.normal)
  -- Default text color and background.
  -- TypeScript: `const foo = 42;`
  -- Elixir:     `foo = 42`
  -- Go:         `foo := 42`
  -- HTML:       `<p>Hello World</p>`

  -- hl('ColorColumn', { bg = 'yellow' }) -- Floating windows
  -- hl('NormalFloat', { link = 'Normal' }) -- Floating windows
  -- hl('NormalNC', { link = 'Normal' }) -- Non current window
  -- The column used for signs like diagnostics
  hl("SignColumn", { bg = colors.white })
  hl("CursorLineSign", hlGroup.cursorLine)
  hl("FoldColumn", { bg = colors.white })
  hl("CursorLineFold", hlGroup.cursorLine)
  -- hl('EndOfBuffer', { link = 'Normal' }) -- The area after the end of line (which might display ~)
  -- hl('LineNr', { link = 'Normal' }) -- Line numbers
  hl("CursorLine", hlGroup.cursorLine) -- The highlight for the current line
  -- hl('VertSplit', { link = 'Normal' }) -- The vertical split separator

  vim.opt.guicursor = "n-v-c:block-Cursor"
  hl("Cursor", hlGroup.cursor) -- The color of the cursor. (No code example)
  hl("Visual", hlGroup.visual) -- Visual mode selection highlighting. (No code example)
  hl("Search", hlGroup.search) -- Search highlighting. (No code example)
  hl("CurSearch", { fg = colors.white, bg = colors.orange }) -- Search highlighting. (No code example)
  hl("IncSearch", { fg = colors.white, bg = colors.orange }) -- Incremental search highlighting. (No code example)
  hl("@string.escape", hlGroup.text)

  -- Diagnostics (minimal, stateful colors only)
  hl("DiagnosticError", { fg = colors.red })
  hl("DiagnosticWarn", { fg = colors.orange })
  hl("DiagnosticInfo", { fg = colors.orangeDim })
  hl("DiagnosticHint", { fg = colors.greenDim })
  hl("DiagnosticOk", { fg = colors.green })
  hl("DiagnosticDeprecated", { strikethrough = true })
  hl("DiagnosticUnnecessary", { fg = colors.blackSubtle })

  hl("DiagnosticSignError", { link = "DiagnosticError" })
  hl("DiagnosticSignWarn", { link = "DiagnosticWarn" })
  hl("DiagnosticSignInfo", { link = "DiagnosticInfo" })
  hl("DiagnosticSignHint", { link = "DiagnosticHint" })
  hl("DiagnosticSignOk", { link = "DiagnosticOk" })

  hl("DiagnosticVirtualTextError", { fg = colors.redDim })
  hl("DiagnosticVirtualTextWarn", { fg = colors.orangeDim })
  hl("DiagnosticVirtualTextInfo", { fg = colors.orangeDim })
  hl("DiagnosticVirtualTextHint", { fg = colors.greenDim })
  hl("DiagnosticVirtualTextOk", { fg = colors.greenDim })

  hl("DiagnosticFloatingError", { link = "DiagnosticError" })
  hl("DiagnosticFloatingWarn", { link = "DiagnosticWarn" })
  hl("DiagnosticFloatingInfo", { link = "DiagnosticInfo" })
  hl("DiagnosticFloatingHint", { link = "DiagnosticHint" })
  hl("DiagnosticFloatingOk", { link = "DiagnosticOk" })

  hl("DiagnosticUnderlineError", { undercurl = true, sp = colors.red })
  hl("DiagnosticUnderlineWarn", { undercurl = true, sp = colors.orange })
  hl("DiagnosticUnderlineInfo", { undercurl = true, sp = colors.orangeDim })
  hl("DiagnosticUnderlineHint", { undercurl = true, sp = colors.greenDim })
  hl("DiagnosticUnderlineOk", { undercurl = true, sp = colors.green })

  -- Built-in diff groups (subtle backgrounds; matches GitSigns line highlights)
  hl("DiffAdd", { bg = colors.greenSoft })
  hl("DiffChange", { bg = colors.orangeSoft })
  hl("DiffDelete", { bg = colors.redSoft })
  hl("DiffText", { bg = colors.orangeSoft, bold = true })
  hl("CursorLineNr", hlGroup.cursorLine, hlGroup.fun, { bold = true }) -- Line number color. (No code example)
  hl("StatusLine", hlGroup.statusLine) -- Status line of the current window. (No code example)
  hl("StatusLineNC", hlGroup.statusLineNC) -- Status line of non-current windows. (No code example)
  hl("Directory", hlGroup.directory) -- Directory names (No code example)
  hl("@variable.builtin.typescript", hlGroup.text)
  hl("@tag.attribute.tsx", hlGroup.text)
  hl("@lsp.type.class.typescript", hlGroup.text)

  -- Comments
  hl("Comment", hlGroup.comment)
  -- Comments in code.
  -- TypeScript: `// This is a comment`
  -- Elixir:     `# This is a comment`
  -- Go:         `// This is a comment`
  -- HTML:       `<!-- This is a comment -->`

  -- Constants
  hl("Constant", hlGroup.text)
  -- Any constant.
  -- TypeScript: const foo = `42`;
  -- Elixir:     foo = `42`
  -- Go:         foo := `42`
  -- HTML:       N/A

  hl("String", hlGroup.value)
  -- Strings, typically text between quotes.
  -- TypeScript: const foo = `"Hello, World!"`;
  -- Elixir:     foo = `"Hello, World!"`
  -- Go:         foo := `"Hello, World!"`
  -- HTML:       `<p>"Hello, World!"</p>`

  hl("Character", hlGroup.value)
  -- Character constants, usually single characters.
  -- TypeScript: const char = `'A'`;
  -- Elixir:     char = `'A'`
  -- Go:         char := `'A'`
  -- HTML:       N/A

  hl("Number", hlGroup.value)
  -- Numeric constants.
  -- TypeScript: const num = `123`;
  -- Elixir:     num = `123`
  -- Go:         num := `123`
  -- HTML:       N/A

  hl("Boolean", hlGroup.value)
  -- Boolean values.
  -- TypeScript: const foo = `true`;
  -- Elixir:     foo = `true`
  -- Go:         foo := `true`
  -- HTML:       N/A

  hl("Float", hlGroup.value)
  -- Floating point numbers.
  -- TypeScript: const num = `3.14`;
  -- Elixir:     num = `3.14`
  -- Go:         num := `3.14`
  -- HTML:       N/A

  -- Identifiers
  --hl('Identifier', { link = 'Normal' })
  -- Any variable name.
  -- TypeScript: `const foo` = 42;
  -- Elixir:     `foo` = 42
  -- Go:         `foo` := 42
  -- HTML:       `<p id="`foo`">Hello World</p>`

  hl("Function", hlGroup.fun)
  -- hl("@constructor.javascript", { link = "Type" })
  -- Function names.
  -- TypeScript: function `myFunction`() {}
  -- Elixir:     def `my_function`() do end
  -- Go:         func `myFunction`() {}
  -- HTML:       N/A

  -- Statements
  hl("Statement", hlGroup.keyword)
  -- Any statement (if, while, etc.).
  -- TypeScript: `if` (true) {}
  -- Elixir:     `if` true do end
  -- Go:         `if` true {}
  -- HTML:       N/A

  hl("Conditional", hlGroup.keyword)
  -- Conditional statements (if, else, switch).
  -- TypeScript: `if` (true) {} `else` {}
  -- Elixir:     `if` true do end
  -- Go:         `if` true {} `else` {}
  -- HTML:       N/A

  hl("Repeat", hlGroup.keyword)
  -- Loop statements (for, while, etc.).
  -- TypeScript: `for` (let i = 0; i < 10; i++) {}
  -- Elixir:     `for` i <- 1..10 do end
  -- Go:         `for` i := 0; i < 10; i++ {}
  -- HTML:       N/A

  hl("Label", hlGroup.keyword)
  -- Labels (case, default, etc.).
  -- TypeScript: switch (foo) { `case` 1: break; }
  -- Elixir:     N/A
  -- Go:         `switch` foo { `case` 1: break }
  -- HTML:       N/A

  hl("Operator", hlGroup.operator)
  -- Operators (e.g., +, -, *, /, %, etc.).
  -- TypeScript: const sum = 1 `+` 2;
  -- Elixir:     sum = 1 `+` 2
  -- Go:         sum := 1 `+` 2
  -- HTML:       N/A

  hl("Keyword", hlGroup.keyword)
  -- Keywords (e.g., return, class, static, etc.).
  -- TypeScript: `return` foo;
  -- Elixir:     `end`
  -- Go:         `return` foo
  -- HTML:       `<!DOCTYPE` html>

  hl("Exception", hlGroup.keyword)
  -- Exception-related keywords.
  -- TypeScript: `throw` new Error();
  -- Elixir:     `raise` "error"
  -- Go:         N/A
  -- HTML:       N/A

  -- Preprocessor
  hl("PreProc", hlGroup.keyword)
  -- Generic preprocessor commands (e.g., #include, #define).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  hl("Include", hlGroup.keyword)
  -- Preprocessor include statements (e.g., #include).
  -- TypeScript: `import` foo from 'bar';
  -- Elixir:     `import` Enum
  -- Go:         `import` "fmt"
  -- HTML:       N/A

  hl("Define", hlGroup.keyword)
  -- Preprocessor define statements (e.g., #define).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('Macro', { link = 'Normal' })
  -- Macros (e.g., macros in C).
  -- TypeScript: N/A
  -- Elixir:     `use` MyAppWeb, :controller
  -- Go:         N/A
  -- HTML:       N/A

  hl("PreCondit", hlGroup.keyword)
  -- Preprocessor conditionals (e.g., #if, #ifdef).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  -- Types
  hl("Type", hlGroup.type)
  -- General type names (e.g., int, float, char, etc.).
  -- TypeScript: `number` foo = 42;
  -- Elixir:     N/A
  -- Go:         `int` foo = 42
  -- HTML:       `<input type="`text`">`

  --hl('StorageClass', { link = 'Normal' })
  -- Storage class specifiers (e.g., static, register).
  -- TypeScript: `static` foo = 42;
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  hl("Structure", hlGroup.keyword)
  -- Struct, union, enum, etc.
  -- TypeScript: `interface` MyInterface {}
  -- Elixir:     `defstruct` foo: nil
  -- Go:         `struct` MyStruct {}
  -- HTML:       N/A

  hl("Typedef", hlGroup.keyword)
  -- Typedefs.
  -- TypeScript: `type` MyType = number;
  -- Elixir:     N/A
  -- Go:         `type` MyType int
  -- HTML:       N/A

  -- Special
  hl("Special", hlGroup.value)
  -- Any special symbol.
  -- TypeScript: foo.`toString`();
  -- Elixir:     `@doc` "documentation"
  -- Go:         foo.`ToString`()
  -- HTML:       `<!DOCTYPE` html>

  --hl('SpecialChar', { link = 'Normal' })
  -- Special characters (e.g., non-printing characters).
  -- TypeScript: const foo = '\`n\`';
  -- Elixir:     foo = '\`n\`'
  -- Go:         foo := '\`n\`'
  -- HTML:       N/A

  hl("Tag", hlGroup.tag)
  -- Tags (e.g., HTML tags).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<`div`>Hello World</div>`

  hl("Delimiter", hlGroup.delimiter)
  -- Delimiters (e.g., braces, brackets, parentheses).
  -- TypeScript: foo(`(`bar`)`);
  -- Elixir:     foo(`[`bar`]`)
  -- Go:         foo(`(`bar`)`)
  -- HTML:       `<p`>Hello World</p>`

  hl("SpecialComment", hlGroup.comment)
  -- Special comments.
  -- TypeScript: `/** Special comment */`
  -- Elixir:     `@moduledoc` """
  -- Go:         N/A
  -- HTML:       N/A

  --hl('Debug', { link = 'Normal' })
  -- Debugging statements.
  -- TypeScript: `debugger`;
  -- Elixir:     IEx.`pry`()
  -- Go:         N/A
  -- HTML:       N/A

  -- Treesitter
  -- Keep treesitter + LSP semantic tokens aligned with the minimal palette.
  -- hl("@comment", { link = "Comment" })
  -- hl("@comment.documentation", { link = "Comment" })

  -- hl("@string", { link = "String" })
  -- hl("@string.escape", { link = "String" })
  -- hl("@string.regexp", { link = "String" })
  -- hl("@string.special.url", { link = "String" })

  -- hl("@number", { link = "Number" })
  -- hl("@number.float", { link = "Float" })
  -- hl("@boolean", { link = "Boolean" })
  -- hl("@character.special", { link = "Character" })

  -- hl("@constant", { link = "Constant" })
  -- hl("@constant.builtin", { link = "Constant" })

  -- hl("@type", { link = "Type" })
  -- hl("@type.builtin", { link = "Type" })
  -- hl("@type.definition", { link = "Type" })
  -- hl("@constructor", { link = "Type" })

  -- hl("@attribute", { link = "Keyword" })
  -- hl("@keyword", { link = "Keyword" })
  -- hl("@keyword.function", { link = "Keyword" })
  -- hl("@keyword.import", { link = "Keyword" })
  -- hl("@keyword.type", { link = "Keyword" })
  -- hl("@keyword.modifier", { link = "Keyword" })
  -- hl("@keyword.operator", { link = "Keyword" })
  -- hl("@keyword.conditional", { link = "Keyword" })
  -- hl("@keyword.conditional.ternary", { link = "Keyword" })
  -- hl("@keyword.repeat", { link = "Keyword" })
  -- hl("@keyword.return", { link = "Keyword" })
  -- hl("@keyword.coroutine", { link = "Keyword" })
  -- hl("@keyword.directive", { link = "Keyword" })
  -- hl("@keyword.exception", { link = "Keyword" })

  -- hl("@operator", { link = "Operator" })
  -- hl("@punctuation.delimiter", { link = "Delimiter" })
  -- hl("@punctuation.bracket", { link = "Delimiter" })
  -- hl("@punctuation.special", { link = "Delimiter" })

  -- hl("@function", { link = "Function" })
  -- hl("@function.call", { link = "Function" })
  -- hl("@function.method", { link = "Function" })
  -- hl("@function.method.call", { link = "Function" })
  -- hl("@function.builtin", hlGroup.value)

  -- hl("@module.builtin", hlGroup.value)
  -- hl("@label", { link = "Keyword" })

  -- hl("@variable.parameter.builtin", hlGroup.value)

  hl("@variable", hlGroup.text)
  -- Variables.
  -- TypeScript: `foo` = 42;
  -- Elixir:     `foo` = 42
  -- Go:         `foo` := 42
  -- HTML:       `<p id="`foo`">Hello World</p>`

  hl("@variable.builtin", hlGroup.value)
  -- Built-in variables (e.g., this in JS).
  -- TypeScript: `this`.foo = 42;
  -- Elixir:     `self`.foo = 42
  -- Go:         N/A
  -- HTML:       N/A

  hl("@variable.parameter", hlGroup.text)
  hl("@lsp.type.property", hlGroup.property)
  hl("@lsp.type.property.typescriptreact", hlGroup.property)

  -- LSP semantic tokens (these can override treesitter)
  hl("@lsp.type.comment", { link = "Comment" })
  hl("@lsp.type.keyword", { link = "Keyword" })
  hl("@lsp.type.modifier", { link = "Keyword" })
  hl("@lsp.type.operator", { link = "Operator" })
  hl("@lsp.type.string", { link = "String" })
  hl("@lsp.type.number", { link = "Number" })
  hl("@lsp.type.regexp", { link = "String" })

  hl("@lsp.type.type", { link = "Type" })
  -- hl("@lsp.type.class", { link = "Type" })
  hl("@lsp.type.interface", { link = "Type" })
  hl("@lsp.type.struct", { link = "Type" })
  hl("@lsp.type.enum", { link = "Type" })
  hl("@lsp.type.typeParameter", { link = "Type" })
  hl("@lsp.type.enumMember", { link = "Constant" })

  hl("@lsp.type.function", { link = "Function" })
  hl("@lsp.type.method", { link = "Function" })

  hl("@lsp.type.namespace", hlGroup.namespace)
  hl("@lsp.type.macro", { link = "Keyword" })
  hl("@lsp.type.decorator", { link = "Keyword" })
  hl("@lsp.type.event", { link = "Keyword" })

  hl("@lsp.type.parameter", hlGroup.text)
  hl("@lsp.type.variable", hlGroup.text)

  hl("@lsp.mod.deprecated", { strikethrough = true })
  -- hl("@lsp.mod.defaultLibrary", hlGroup.value)
  -- Function parameters.
  -- TypeScript: function foo(`bar`) {}
  -- Elixir:     def foo(`bar`) do end
  -- Go:         func foo(`bar` int) {}
  -- HTML:       N/A

  --hl('@variable.parameter.builtin', { link = 'Normal' })
  -- Built-in function parameters (rarely used).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  hl("@variable.member", hlGroup.member)
  hl("@apz.member", hlGroup.member)
  hl("@apz.property", hlGroup.property)
  hl("@apz.property.templ", hlGroup.property, hlGroup.text)
  hl("jsonKeyword", hlGroup.member)
  -- Members of a class or object.
  -- TypeScript: obj.`member` = 42;
  -- Elixir:     obj.`member` = 42
  -- Go:         obj.`member` = 42
  -- HTML:       `<p id="`member`">Hello World</p>`

  --hl('@constant', { link = 'Normal' })
  -- Constants (e.g., literals, immutable variables).
  -- TypeScript: const foo = `42`;
  -- Elixir:     foo = `42`
  -- Go:         foo := `42`
  -- HTML:       N/A

  hl("@constant.builtin", hlGroup.value)
  -- Built-in constant values.
  -- TypeScript: const foo = `undefined`;
  -- Elixir:     foo = `nil`
  -- Go:         foo := `nil`
  -- HTML:       N/A

  --hl('@constant.macro', { link = 'Normal' })
  -- Constants defined by macros.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@module', { link = 'Normal' })
  -- Module or namespace names.
  -- TypeScript: `MyNamespace`.foo = 42;
  -- Elixir:     `MyModule`.foo = 42
  -- Go:         `mymodule`.foo = 42
  -- HTML:       N/A

  --hl('@module.builtin', { link = 'Normal' })
  -- Built-in modules or namespaces.
  -- TypeScript: `console.log`("Hello, World!");
  -- Elixir:     `IO.puts` "Hello, World!"
  -- Go:         `fmt.Println`("Hello, World!")
  -- HTML:       N/A

  --hl('@label', { link = 'Normal' })
  -- Labels (e.g., case, default, etc.).
  -- TypeScript: switch (foo) { `case` 1: break; }
  -- Elixir:     N/A
  -- Go:         `switch` foo { `case` 1: break }
  -- HTML:       N/A

  --hl('@string', { link = 'Normal' })
  -- String literals.
  -- TypeScript: const foo = `"Hello, World!"`;
  -- Elixir:     foo = `"Hello, World!"`
  -- Go:         foo := `"Hello, World!"`
  -- HTML:       `<p>"`Hello, World!`"</p>`

  --hl('@string.documentation', { link = 'Normal' })
  -- Documentation strings.
  -- TypeScript: N/A
  -- Elixir:     @doc `"This is documentation"`
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@string.regexp', { link = 'Normal' })
  -- Regular expressions.
  -- TypeScript: const regex = `/\d+/`;
  -- Elixir:     regex = ~r`\d+`
  -- Go:         regex := regexp.MustCompile(``\d+`)
  -- HTML:       N/A

  --hl('@string.escape', { link = 'Normal' })
  -- Escape sequences within strings.
  -- TypeScript: const foo = "Hello, `\n`World!";
  -- Elixir:     foo = "Hello, `\n`World!"
  -- Go:         foo := "Hello, `\n`World!"
  -- HTML:       N/A

  --hl('@string.special', { link = 'Normal' })
  -- Special strings (e.g., HTML in templates).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<style>`p { color: red; }`</style>`

  --hl('@string.special.symbol', { link = 'Normal' })
  -- Symbol-like strings.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@string.special.path', { link = 'Normal' })
  -- Path-like strings (e.g., file paths).
  -- TypeScript: N/A
  -- Elixir:     `"/home/user/file"`
  -- Go:         `"/home/user/file"`
  -- HTML:       N/A

  --hl('@string.special.url', { link = 'Normal' })
  -- URL-like strings.
  -- TypeScript: const url = `"https://example.com"`;
  -- Elixir:     url = `"https://example.com"`
  -- Go:         url := `"https://example.com"`
  -- HTML:       `<a href="`https://example.com`">Example</a>`

  --hl('@character', { link = 'Normal' })
  -- Character literals.
  -- TypeScript: const char = `'a'`;
  -- Elixir:     char = `'a'`
  -- Go:         char := `'a'`
  -- HTML:       N/A

  --hl('@character.special', { link = 'Normal' })
  -- Special characters.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@boolean', { link = 'Normal' })
  -- Boolean values.
  -- TypeScript: const foo = `true`;
  -- Elixir:     foo = `true`
  -- Go:         foo := `true`
  -- HTML:       N/A

  --hl('@number', { link = 'Normal' })
  -- Numeric constants.
  -- TypeScript: const num = `123`;
  -- Elixir:     num = `123`
  -- Go:         num := `123`
  -- HTML:       N/A

  --hl('@number.float', { link = 'Normal' })
  -- Floating-point numbers.
  -- TypeScript: const num = `3.14`;
  -- Elixir:     num = `3.14`
  -- Go:         num := `3.14`
  -- HTML:       N/A

  --hl('@type', { link = 'Normal' })
  -- Type names (e.g., int, float, char).
  -- TypeScript: `number` foo = 42;
  -- Elixir:     N/A
  -- Go:         `int` foo = 42
  -- HTML:       `<input type="`text`">`

  --hl('@type.builtin', { link = 'Normal' })
  -- Built-in types (e.g., int, float in C).
  -- TypeScript: `number` foo = 42;
  -- Elixir:     `integer` foo = 42
  -- Go:         `int` foo = 42
  -- HTML:       N/A

  --hl('@type.definition', { link = 'Normal' })
  -- Type definitions (e.g., typedef in C).
  -- TypeScript: `type` MyType = number;
  -- Elixir:     N/A
  -- Go:         `type` MyType int
  -- HTML:       N/A

  --hl('@attribute', { link = 'Normal' })
  -- Attributes (e.g., decorators).
  -- TypeScript: `@decorator`
  -- Elixir:     @doc `"This is a doc"`
  -- Go:         N/A
  -- HTML:       `<p `id="foo">Hello World</p>`

  --hl('@attribute.builtin', { link = 'Normal' })
  -- Built-in attributes.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<input `type="text">`

  hl("@property", hlGroup.property)
  -- Properties of objects or classes.
  -- TypeScript: obj.`property` = 42;
  -- Elixir:     obj.`property` = 42
  -- Go:         obj.`property` = 42
  -- HTML:       `<p id="`property`">Hello World</p>`

  --hl('@function', { link = 'Normal' })
  -- Function names.
  -- TypeScript: function `myFunction`() {}
  -- Elixir:     def `my_function`() do end
  -- Go:         func `myFunction`() {}
  -- HTML:       N/A

  --hl('@function.builtin', { link = 'Normal' })
  -- Built-in functions.
  -- TypeScript: `console.log`("Hello, World!");
  -- Elixir:     `IO.puts` "Hello, World!"
  -- Go:         `fmt.Println`("Hello, World!")
  -- HTML:       N/A

  --hl('@function.call', { link = 'Normal' })
  -- Function calls.
  -- TypeScript: `myFunction`();
  -- Elixir:     `my_function`() do end
  -- Go:         `myFunction`()
  -- HTML:       N/A

  --hl('@function.macro', { link = 'Normal' })
  -- Macros or function-like macros.
  -- TypeScript: N/A
  -- Elixir:     `defmacro` my_macro() do end
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@function.method', { link = 'Normal' })
  -- Method names in classes.
  -- TypeScript: class Foo { `myMethod`() {} }
  -- Elixir:     defmodule Foo do def `my_method`() do end end
  -- Go:         func (f Foo) `myMethod`() {}
  -- HTML:       N/A

  --hl('@function.method.call', { link = 'Normal' })
  -- Method calls.
  -- TypeScript: obj.`myMethod`();
  -- Elixir:     obj.`my_method`()
  -- Go:         obj.`myMethod`()
  -- HTML:       N/A

  --hl('@constructor', { link = 'Normal' })
  -- Constructor methods.
  -- TypeScript: class Foo { `constructor`() {} }
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@operator', { link = 'Normal' })
  -- Operators (e.g., +, -, *, /).
  -- TypeScript: 1 `+` 2;
  -- Elixir:     1 `+` 2
  -- Go:         1 `+` 2
  -- HTML:       N/A

  --hl('@keyword', { link = 'Normal' })
  -- Keywords (e.g., if, else, for).
  -- TypeScript: `if` (true) {}
  -- Elixir:     `if` true do end
  -- Go:         `if` true {}
  -- HTML:       N/A

  --hl('@keyword.coroutine', { link = 'Normal' })
  -- Coroutine-related keywords.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@keyword.function', { link = 'Normal' })
  -- Function-related keywords.
  -- TypeScript: `function` foo() {}
  -- Elixir:     `def` foo() do end
  -- Go:         `func` foo() {}
  -- HTML:       N/A

  --hl('@keyword.operator', { link = 'Normal' })
  -- Operator-related keywords.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@keyword.import', { link = 'Normal' })
  -- Import-related keywords.
  -- TypeScript: `import` { foo } from 'bar';
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@keyword.type', { link = 'Normal' })
  -- Type-related keywords.
  -- TypeScript: `type` Foo = {};
  -- Elixir:     N/A
  -- Go:         `type` Foo struct {}
  -- HTML:       N/A

  --hl('@keyword.modifier', { link = 'Normal' })
  -- Modifiers (e.g., public, private).
  -- TypeScript: `public` foo() {}
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@keyword.repeat', { link = 'Normal' })
  -- Loop-related keywords.
  -- TypeScript: `for` (let i = 0; i < 10; i++) {}
  -- Elixir:     `for` i <- 1..10 do end
  -- Go:         `for` i := 0; i < 10; i++ {}
  -- HTML:       N/A

  --hl('@keyword.return', { link = 'Normal' })
  -- Return-related keywords.
  -- TypeScript: `return` foo;
  -- Elixir:     `return` foo
  -- Go:         `return` foo
  -- HTML:       N/A

  --hl('@keyword.debug', { link = 'Normal' })
  -- Debugging-related keywords.
  -- TypeScript: `debugger`;
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@keyword.exception', { link = 'Normal' })
  -- Exception-related keywords.
  -- TypeScript: `throw` new Error();
  -- Elixir:     `raise` "Error"
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@keyword.conditional', { link = 'Normal' })
  -- Conditional-related keywords.
  -- TypeScript: `if` (true) {}
  -- Elixir:     `if` true do end
  -- Go:         `if` true {}
  -- HTML:       N/A

  --hl('@keyword.conditional.ternary', { link = 'Normal' })
  -- Ternary conditional operators.
  -- TypeScript: const foo = true ? `1` : `0`;
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@keyword.directive', { link = 'Normal' })
  -- Preprocessor directives.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@keyword.directive.define', { link = 'Normal' })
  -- Define-related preprocessor directives.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@punctuation.delimiter', { link = 'Normal' })
  -- Delimiters (e.g., commas, semicolons).
  -- TypeScript: foo, `;`
  -- Elixir:     foo, `;`
  -- Go:         foo, `;`
  -- HTML:       N/A

  --hl('@punctuation.bracket', { link = 'Normal' })
  -- Brackets (e.g., parentheses, square brackets).
  -- TypeScript: `(`foo`)`
  -- Elixir:     `(`foo`)`
  -- Go:         `(`foo`)`
  -- HTML:       `<`a`>`

  hl("@punctuation.special", hlGroup.text)
  hl("@string.special.elixir", hlGroup.text)
  -- Special punctuation (e.g., ellipsis, arrows).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@comment', { link = 'Normal' })
  -- Comments in code.
  -- TypeScript: `// This is a comment`
  -- Elixir:     `# This is a comment`
  -- Go:         `// This is a comment`
  -- HTML:       `<!-- This is a comment -->`

  --hl('@comment.documentation', { link = 'Normal' })
  -- Documentation comments.
  -- TypeScript: `/** This is documentation */`
  -- Elixir:     @doc `"This is documentation"`
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@comment.error', { link = 'Normal' })
  -- Error-related comments.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@comment.warning', { link = 'Normal' })
  -- Warning-related comments.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  --hl('@comment.todo', { link = 'Normal' })
  -- TODO comments.
  -- TypeScript: `// TODO: Fix this`
  -- Elixir:     `# TODO: Fix this`
  -- Go:         `// TODO: Fix this`
  -- HTML:       `<!-- TODO: Fix this -->`

  --hl('@comment.note', { link = 'Normal' })
  -- Note comments.
  -- TypeScript: `// NOTE: Check this`
  -- Elixir:     `# NOTE: Check this`
  -- Go:         `// NOTE: Check this`
  -- HTML:       `<!-- NOTE: Check this -->`

  --hl('@markup.strong', { link = 'Normal' })
  -- Strong emphasis (bold).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<strong>`Hello World`</strong>`

  --hl('@markup.italic', { link = 'Normal' })
  -- Italic emphasis.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<em>`Hello World`</em>`

  --hl('@markup.strikethrough', { link = 'Normal' })
  -- Strikethrough text.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<del>`Hello World`</del>`

  --hl('@markup.underline', { link = 'Normal' })
  -- Underlined text.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<u>`Hello World`</u>`

  --hl('@markup.heading', { link = 'Normal' })
  -- Headings (titles).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<h1>`Hello World`</h1>`

  --hl('@markup.heading.1', { link = 'Normal' })
  -- Level 1 headings.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<h1>`Hello World`</h1>`

  --hl('@markup.heading.2', { link = 'Normal' })
  -- Level 2 headings.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<h2>`Hello World`</h2>`

  --hl('@markup.heading.3', { link = 'Normal' })
  -- Level 3 headings.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<h3>`Hello World`</h3>`

  --hl('@markup.heading.4', { link = 'Normal' })
  -- Level 4 headings.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<h4>`Hello World`</h4>`

  --hl('@markup.heading.5', { link = 'Normal' })
  -- Level 5 headings.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<h5>`Hello World`</h5>`

  --hl('@markup.heading.6', { link = 'Normal' })
  -- Level 6 headings.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<h6>`Hello World`</h6>`

  --hl('@markup.quote', { link = 'Normal' })
  -- Blockquotes.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<blockquote>`Hello World`</blockquote>`

  --hl('@markup.math', { link = 'Normal' })
  -- Mathematical expressions.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<math>`2+2=4`</math>`

  --hl('@markup.link', { link = 'Normal' })
  -- Hyperlinks.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<a href="`https://example.com`">Example</a>`

  --hl('@markup.link.label', { link = 'Normal' })
  -- Hyperlink labels.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<a href="https://example.com">`Example`</a>`

  --hl('@markup.link.url', { link = 'Normal' })
  -- URLs within hyperlinks.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<a href="`https://example.com`">Example</a>`

  --hl('@markup.raw', { link = 'Normal' })
  -- Raw (unformatted) text.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<code>`print("Hello World")`</code>`

  --hl('@markup.raw.block', { link = 'Normal' })
  -- Raw block text.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<pre>`print("Hello World")`</pre>`

  --hl('@markup.list', { link = 'Normal' })
  -- Lists (e.g., bullet points).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<ul>`<li>Hello World</li>`</ul>`

  --hl('@markup.list.checked', { link = 'Normal' })
  -- Checked list items.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<input type="checkbox" checked>`

  --hl('@markup.list.unchecked', { link = 'Normal' })
  -- Unchecked list items.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<input type="checkbox">`

  --hl('@diff.plus', { link = 'Normal' })
  -- Added lines in diffs.
  -- TypeScript: `+ Added line`
  -- Elixir:     `+ Added line`
  -- Go:         `+ Added line`
  -- HTML:       N/A

  --hl('@diff.minus', { link = 'Normal' })
  -- Removed lines in diffs.
  -- TypeScript: `- Removed line`
  -- Elixir:     `- Removed line`
  -- Go:         `- Removed line`
  -- HTML:       N/A

  --hl('@diff.delta', { link = 'Normal' })
  -- Modified lines in diffs.
  -- TypeScript: `~ Modified line`
  -- Elixir:     `~ Modified line`
  -- Go:         `~ Modified line`
  -- HTML:       N/A

  hl("@tag", hlGroup.tag)
  -- hl('@tag.templ', hlGroup.tag)
  -- Tags (e.g., HTML tags).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<`p`>`

  hl("@tag.builtin", hlGroup.tag)
  -- Built-in tags.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       N/A

  -- hl("@tag.attribute", hlGroup.tagAttribute)
  -- hl("@tag.attribute.templ", hlGroup.tagAttribute)
  -- Attributes within tags.
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<p `id="foo">Hello World</p>`

  hl("@tag.delimiter", { link = "Delimiter" })
  -- Tag delimiters (e.g., <, >).
  -- TypeScript: N/A
  -- Elixir:     N/A
  -- Go:         N/A
  -- HTML:       `<`p`>`

  -- Plugin: GitSigns
  hl("GitSignsAdd", { fg = colors.green })
  hl("GitSignsChange", { fg = colors.orange })
  hl("GitSignsDelete", { fg = colors.red })
  hl("GitSignsAddNr", { fg = colors.green })
  hl("GitSignsChangeNr", { fg = colors.orange })
  hl("GitSignsDeleteNr", { fg = colors.red })
  hl("GitSignsAddLn", { bg = colors.greenSoft })
  hl("GitSignsChangeLn", { bg = colors.orangeSoft })
  hl("GitSignsDeleteLn", { bg = colors.redSoft })
  hl("GitSignsCurrentLineBlame", hlGroup.comment)

  -- Plugin: Telescope
  hl("TelescopeSelection", hlGroup.cursorLine)
  hl("TelescopeSelectionCaret", hlGroup.cursorLine, hlGroup.fun, { bold = true })
  hl("TelescopeMatching", hlGroup.search)
  hl("TelescopeResultsComment", { fg = colors.blackSubtle })
  -- hl('TelescopeResults', hlGroup.value)

  -- Plugin: Telescope
  hl("EyelinerPrimary", hlGroup.search, { fg = colors.white, bg = colors.orange })
  hl("EyelinerSecondary", hlGroup.cursorLine)
end

local M = { setup = setup }

return M
