return {
  "tpope/vim-fugitive",
  event = "VeryLazy",
  config = function()
    vim.schedule(function()
      vim.keymap.set("n", "<leader>gb", "<cmd>Git blame<cr>", { desc = "Git blame" })
      vim.keymap.set("n", "<leader>gC", "<cmd>Gdiffsplit!<cr>", { desc = "Conflict 3-way split" })
      vim.keymap.set("n", "<leader>gd", "<cmd>Gdiff<cr>", { desc = "Gdiff" })
      vim.keymap.set("n", "<leader>gD", "<cmd>Git log --stat -p<cr>", { desc = "Git log --stat -p" })
      vim.keymap.set("n", "<leader>ge", ":Gedit ", { desc = "Gedit" }) -- Gedit can take commit objects
      vim.keymap.set("n", "<leader>gl", [[<cmd>Git log --format="%h [%ad] [%an] %s"<cr>]], { desc = "Git log oneline" })
      vim.keymap.set("n", "<leader>gL", "<cmd>Git log<cr>", { desc = "Git log" })
      vim.keymap.set("n", "<leader>gg", "<cmd>G<cr>", { desc = "G" })
      vim.keymap.set("n", "<leader>gP", "<cmd>Git pull<cr>", { desc = "Git pull" })
      vim.keymap.set(
        "n",
        "<leader>gp",
        "<cmd>Git -c push.default=current push<cr>",
        { desc = "Git -c push.default=current push" }
      )
      vim.keymap.set("n", "<leader>gr", "<cmd>Gread<cr>", { desc = "Gread" })
      vim.keymap.set("n", "<leader>gw", "<cmd>Gwrite<cr>", { desc = "Gwrite" })
      vim.keymap.set("n", "<leader>gu", "<cmd>diffupdate<cr>", { desc = "diffupdate" })
      vim.keymap.set("n", "<leader>g2", "<cmd>diffget //2<cr>", { desc = "diffget //2" })
      vim.keymap.set("n", "<leader>g3", "<cmd>diffget //3<cr>", { desc = "diffget //3" })
    end)
  end,
}
