return {
  {
    "folke/snacks.nvim",
    ---@type snacks.Config
    opts = {
      scroll = { enabled = false },
      lazygit = {
        enabled = false,
        -- your lazygit configuration comes here
        -- or leave it empty to use the default settings
        -- refer to the configuration section below
      },
      picker = {
        sources = {
          files = {
            args = { "--no-ignore-vcs" }, -- ignore .gitignore, still respect .ignore
          },
          grep = {
            args = { "--no-ignore-vcs" },
          },
        },
        main = {
          file = false,
          current = true,
        },
        win = {
          input = {
            keys = {
              ["<Esc>"] = { "close", mode = { "n", "i" } },
            },
          },
        },
      },
    },
  },
}
