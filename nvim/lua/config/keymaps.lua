-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

-- vim.keymap.set("n", "<C-h>", "<C-w>h", { silent = true, noremap = true })
-- vim.keymap.set("n", "<C-j>", "<C-w>j", { silent = true, noremap = true })
-- vim.keymap.set("n", "<C-k>", "<C-w>k", { silent = true, noremap = true })
-- vim.keymap.set("n", "<C-l>", "<C-w>l", { silent = true, noremap = true })

-- makes ctrl + e and ctrl + y move 2 lines at a time
vim.keymap.set("n", "<C-e>", "2<C-e>")
vim.keymap.set("n", "<C-y>", "2<C-y>")

local function preserve_explicit_register_map(modes, lhs, default_register, rhs)
  vim.keymap.set(modes, lhs, function()
    -- With `clipboard=unnamedplus`, Vim may treat the default register as `+`.
    -- We still want to avoid clipboard unless the user explicitly chose a non-clipboard register.
    if vim.v.register == '"' or vim.v.register == "+" or vim.v.register == "*" or vim.v.register == "" then
      return '"' .. default_register .. rhs
    end
    return rhs
  end, { expr = true, replace_keycodes = false })
end

-- remaps delete to not save text (but still preserves explicit registers via `"a...`)
preserve_explicit_register_map({ "n", "v" }, "d", "d", "d")
preserve_explicit_register_map("n", "D", "d", "D")

-- maps leader + delete to original delete functionality
vim.keymap.set("n", "<leader>yd", '"+d')
vim.keymap.set("n", "<leader>yD", '"+D')
vim.keymap.set("v", "<leader>yd", '"+d')

-- remaps change to not save text
preserve_explicit_register_map({ "n", "v" }, "c", "c", "c")
preserve_explicit_register_map("n", "C", "c", "C")

-- maps leader + change to original change functionality
vim.keymap.set("n", "<leader>yc", '"+c')
vim.keymap.set("n", "<leader>yC", '"+C')
vim.keymap.set("v", "<leader>yc", '"+c')

-- remaps substitute to not save text
preserve_explicit_register_map({ "n", "v" }, "s", "s", "s")
preserve_explicit_register_map("n", "S", "s", "S")

-- maps leader + change to original change functionality
vim.keymap.set("n", "<leader>ys", '"+s')
vim.keymap.set("n", "<leader>yS", '"+S')
vim.keymap.set("v", "<leader>ys", '"+s')

-- remaps delete-char to not save text
preserve_explicit_register_map({ "n", "v" }, "x", "x", "x")
preserve_explicit_register_map("n", "X", "x", "X")

-- maps leader + change to original change functionality
vim.keymap.set("n", "<leader>yx", '"+x')
vim.keymap.set("n", "<leader>yX", '"+X')
vim.keymap.set("v", "<leader>yx", '"+x')
