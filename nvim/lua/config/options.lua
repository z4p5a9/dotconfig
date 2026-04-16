-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

local opt = vim.opt

-- Prepend mise shims to PATH
vim.env.PATH = vim.env.HOME .. "/.local/share/mise/shims:" .. vim.env.PATH

local function ensure_dir(path)
  local p = (path:gsub("/+%s*$", ""))
  if vim.fn.isdirectory(p) == 0 then
    vim.fn.mkdir(p, "p")
  end
end

-- Save undo history
local undodir = os.getenv("HOME") .. "/.cache/nvim/dirs/undodir"
ensure_dir(undodir)
opt.undodir = undodir .. "//"

-- Backup & Swap files
opt.backup = true
local swapdir = os.getenv("HOME") .. "/.cache/nvim/dirs/tmp"
local backupdir = os.getenv("HOME") .. "/.cache/nvim/dirs/backups"
ensure_dir(swapdir)
ensure_dir(backupdir)
opt.directory = swapdir .. "//"
opt.backupdir = backupdir .. "//"

-- Always show N number of lines before/after cursor
opt.scrolloff = 10

-- Disable rendering whitespace markers such as tab as `>`
opt.list = false
