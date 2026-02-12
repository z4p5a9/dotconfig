return {
  "mrjones2014/smart-splits.nvim",
  lazy = false,
  keys = {
    { "<c-h>", "<cmd>SmartCursorMoveLeft<cr>", { silent = true, desc = "navigate left or tab" } },
    { "<c-j>", "<cmd>SmartCursorMoveDown<cr>", { silent = true, desc = "navigate down" } },
    { "<c-k>", "<cmd>SmartCursorMoveUp<cr>", { silent = true, desc = "navigate up" } },
    { "<c-l>", "<cmd>SmartCursorMoveRight<cr>", { silent = true, desc = "navigate right or tab" } },
  },
  opts = {
    -- enable or disable the tmux integration
    tmux_integration = false,
    multiplexer_integration = "zellij",
    auto_setup = true,
  },
}
