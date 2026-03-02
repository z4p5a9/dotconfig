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
    namespace = colors.hueStrong,
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
    background = { bg = semantic.bg },
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
    namespace = { fg = semantic.namespace },

    search = { bg = semantic.highlight },

    tag = { fg = semantic.tag },

    cursor = { fg = semantic.fgInverted, bg = semantic.cursor },
    cursorLine = { bg = semantic.cursorLine },
    visual = { bg = semantic.visual },

    statusLine = { fg = colors.black, bg = "#f7f3f2" },
    statusLineNC = { fg = colors.blackSubtle, bg = colors.white },

    directory = { fg = semantic.directory },
  }

  -- UI
  hl("Normal", hlGroup.background, hlGroup.text) -- Default text color and background.
  -- hl('NormalNC', { link = 'Normal' }) -- Default text color and background for non current window
  -- hl('NormalFloat', { link = 'Normal' }) -- Default text color and background for floating windows
  hl("SignColumn", hlGroup.background)
  hl("FoldColumn", hlGroup.background)
  hl("Visual", hlGroup.visual) -- Visual mode selection highlighting. (No code example)
  hl("StatusLine", hlGroup.statusLine)
  hl("StatusLineNC", hlGroup.statusLineNC) -- Status line of non-current windows. (No code example)
  hl("Directory", hlGroup.directory) -- Directory names (No code example)

  -- UI > Cursor
  vim.opt.guicursor = "n-v-c:block-Cursor"
  hl("Cursor", hlGroup.cursor) -- The color of the cursor. (No code example)
  hl("CursorLine", hlGroup.cursorLine) -- The highlight for the current line
  hl("CursorLineSign", hlGroup.cursorLine)
  hl("CursorLineFold", hlGroup.cursorLine)
  hl("CursorLineNr", hlGroup.cursorLine, { fg = colors.hueStrong }, { bold = true }) -- Line number color. (No code example)

  -- UI > Search
  hl("Search", hlGroup.search) -- Search highlighting. (No code example)
  hl("CurSearch", { fg = semantic.fgInverted, bg = colors.orange }) -- Search highlighting. (No code example)
  hl("IncSearch", { fg = semantic.fgInverted, bg = colors.orange }) -- Incremental search highlighting. (No code example)

  -- UI > Diagnostic
  hl("DiagnosticError", { fg = colors.red })
  hl("DiagnosticWarn", { fg = colors.orange })
  hl("DiagnosticInfo", { fg = colors.orangeDim })
  hl("DiagnosticHint", { fg = colors.greenDim })
  hl("DiagnosticOk", { fg = colors.green })
  hl("DiagnosticDeprecated", { strikethrough = true })
  hl("@lsp.mod.deprecated", { strikethrough = true })
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

  -- UI > Diff
  hl("DiffAdd", { bg = colors.greenSoft })
  hl("DiffChange", { bg = colors.orangeSoft })
  hl("DiffDelete", { bg = colors.redSoft })
  hl("DiffText", { bg = colors.orangeSoft, bold = true })
  --hl('@diff.plus', { link = 'Normal' })
  --hl('@diff.minus', { link = 'Normal' })
  --hl('@diff.delta', { link = 'Normal' })

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

  -- Syntax
  hl("Constant", hlGroup.text)
  -- hl("@constant", { link = "Constant" })
  -- hl("@constant.builtin", { link = "Constant" })
  hl("@variable", hlGroup.text)
  hl("@variable.builtin", hlGroup.text)
  hl("@lsp.type.variable", hlGroup.text)
  hl("@variable.parameter", hlGroup.text)
  hl("@lsp.type.parameter", hlGroup.text)
  hl("Operator", hlGroup.text)
  hl("@lsp.type.operator", { link = "Operator" })
  hl("Delimiter", hlGroup.text)
  hl("@tag.delimiter", { link = "Delimiter" })
  -- hl('Debug', { link = 'Normal' })
  hl("@punctuation.special", hlGroup.text)
  hl("@string.special.elixir", hlGroup.text)
  hl("@lsp.type.function", { link = "Function" })
  hl("@lsp.type.method", { link = "Function" })
  hl("@lsp.type.namespace", hlGroup.namespace)
  hl("@module.elixir", hlGroup.namespace)

  -- Syntax > Comment
  hl("Comment", hlGroup.comment)
  hl("SpecialComment", hlGroup.comment)
  -- hl("@comment", { link = "Comment" })
  -- hl("@comment.documentation", { link = "Comment" })
  -- hl('@comment.error', { link = 'Normal' })
  -- hl('@comment.warning', { link = 'Normal' })
  -- hl('@comment.todo', { link = 'Normal' })
  -- hl('@comment.note', { link = 'Normal' })
  hl("@lsp.type.comment", { link = "Comment" })

  -- Syntax > Value
  hl("String", hlGroup.value)
  -- hl("@string", { link = "String" })
  -- hl("@string.escape", { link = "String" })
  -- hl("@string.regexp", { link = "String" })
  -- hl("@string.special.url", { link = "String" })
  hl("@lsp.type.string", { link = "String" })
  hl("@lsp.type.regexp", { link = "String" })
  hl("Character", hlGroup.value)
  hl("SpecialChar", hlGroup.value)
  -- hl("@character.special", { link = "Character" })
  hl("Number", hlGroup.value)
  -- hl("@number", { link = "Number" })
  -- hl("@number.float", { link = "Float" })
  hl("@lsp.type.number", { link = "Number" })
  hl("Boolean", hlGroup.value)
  -- hl("@boolean", { link = "Boolean" })
  hl("Float", hlGroup.value)
  hl("Float", hlGroup.value)
  hl("Function", hlGroup.fun)
  --hl('Identifier', { link = 'Normal' })
  hl("Special", hlGroup.value)

  -- Syntax > Keyword
  hl("Keyword", hlGroup.keyword)
  -- hl("@keyword", { link = "Keyword" })
  hl("@lsp.type.keyword", { link = "Keyword" })
  hl("Statement", hlGroup.keyword)
  hl("Conditional", hlGroup.keyword)
  hl("Repeat", hlGroup.keyword)
  hl("Label", hlGroup.keyword)
  hl("Include", hlGroup.keyword)
  hl("Exception", hlGroup.keyword)
  hl("Structure", hlGroup.keyword)
  hl("StorageClass", hlGroup.keyword)
  hl("Typedef", hlGroup.keyword)
  -- hl("@type.definition", { link = "Type" })
  -- hl("@attribute", { link = "Keyword" })
  hl("@lsp.type.modifier", { link = "Keyword" })
  hl("Macro", hlGroup.keyword)
  hl("PreProc", hlGroup.keyword)
  hl("PreCondit", hlGroup.keyword)
  hl("Define", hlGroup.keyword)
  hl("@lsp.type.macro", { link = "Keyword" })
  hl("@lsp.type.decorator", { link = "Keyword" })
  hl("@lsp.type.event", { link = "Keyword" })

  -- Syntax > Tag (markup)
  hl("Tag", hlGroup.tag)
  hl("@tag", hlGroup.tag)
  hl("@tag.builtin", hlGroup.tag)
  -- hl("@tag.attribute", hlGroup.tagAttribute)
  -- hl("@tag.attribute.templ", hlGroup.tagAttribute)

  -- Syntax > Type
  hl("Type", hlGroup.type)
  -- hl("@type", { link = "Type" })
  -- hl("@type.builtin", { link = "Type" })
  -- hl("@constructor", { link = "Type" })
  hl("@lsp.type.type", { link = "Type" })
  hl("@lsp.type.interface", { link = "Type" })
  hl("@lsp.type.struct", { link = "Type" })
  hl("@lsp.type.enum", { link = "Type" })
  hl("@lsp.type.enumMember", { link = "Constant" })

  -- Syntax > property
  hl("@property", hlGroup.property)
  hl("@apz.property", hlGroup.property)
  hl("@lsp.type.property", hlGroup.property)
  hl("@lsp.type.property.typescriptreact", hlGroup.property)
  hl("@variable.member", hlGroup.member)
  hl("@apz.member", hlGroup.member)
  hl("jsonKeyword", hlGroup.member)

  -- hl('@apz.indent_blankline_char', colors.text)
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
  hl("@string.escape", hlGroup.text)

  hl("@variable.builtin.typescript", hlGroup.text)
  hl("@tag.attribute.tsx", hlGroup.text)
  hl("@lsp.type.class.typescript", hlGroup.text)

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
