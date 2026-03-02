local uv = vim.uv or vim.loop
local global_ignore_file = vim.fs.joinpath(vim.env.HOME or "", ".ignore")
local picker_ignore_args = { "--no-ignore-vcs" }

if uv.fs_stat(global_ignore_file) then
  vim.list_extend(picker_ignore_args, { "--ignore-file", global_ignore_file })
end

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
            hidden = true,
            args = picker_ignore_args,
          },
          grep = {
            hidden = true,
            args = picker_ignore_args,
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
