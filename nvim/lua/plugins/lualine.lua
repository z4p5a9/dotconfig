local colors = {
  bg = "#ffffff",
  bg_alt = "#f7f3f2",

  fg = "#000000",
  fg_subtle = "#8c8c8c",

  red = "#eb0000",
  orange = "#f89200",
  green = "#008a00",
}

local section = { fg = colors.fg, bg = colors.bg_alt }
local section_inactive = { fg = colors.fg_subtle, bg = colors.bg }

local theme = {
  normal = {
    a = { fg = colors.red, bg = colors.bg_alt, gui = "bold" },
    b = section,
    c = section,
  },
  insert = {
    a = { fg = colors.green, bg = colors.bg_alt, gui = "bold" },
    b = section,
    c = section,
  },
  visual = {
    a = { fg = colors.orange, bg = colors.bg_alt, gui = "bold" },
    b = section,
    c = section,
  },
  replace = {
    a = { fg = colors.red, bg = colors.bg_alt, gui = "bold" },
    b = section,
    c = section,
  },
  inactive = {
    a = section_inactive,
    b = section_inactive,
    c = section_inactive,
  },
}

return {
  "nvim-lualine/lualine.nvim",
  opts = {
    options = {
      theme = theme,
      globalstatus = false,
      section_separators = { left = "", right = "" },
      component_separators = { left = "", right = "" },
    },
    sections = {
      lualine_a = { "mode" },
      lualine_b = { "branch" },
      lualine_c = {
        LazyVim.lualine.root_dir(),
        {
          "diagnostics",
          symbols = {
            error = "E",
            warn = "W",
            info = "I",
            hint = "H",
          },
          colored = true,
          diagnostics_color = {
            error = { fg = colors.red },
            warn = { fg = colors.orange },
            info = { fg = colors.orange },
            hint = { fg = colors.green },
          },
        },
        { "filetype", icon_only = true, separator = "", padding = { left = 1, right = 0 } },
        { LazyVim.lualine.pretty_path() },
      },
      lualine_z = {},
    },
  },
}
