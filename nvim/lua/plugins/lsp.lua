return {
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        eslint = {},
        vtsls = {
          -- autoUseWorkspaceTsdk = true,
          settings = {
            complete_function_calls = false,
            typescript = {
              inlayHints = false,
              suggest = {
                completeFunctionCalls = false,
              },
            },
          },
        },
      },
      -- setup = {
      --   tsserver = function(_, opts)
      --     opts.capabilities.textDocument.completion.completionItem.snippetSupport = false
      --   end,
      --   ts_ls = function(_, opts)
      --     opts.capabilities.textDocument.completion.completionItem.snippetSupport = false
      --   end,
      --   vtsls = function(_, opts)
      --     opts.capabilities.textDocument.completion.completionItem.snippetSupport = false
      --   end,
      --   eslint = function(_, opts)
      --     opts.capabilities.textDocument.completion.completionItem.snippetSupport = false
      --     require("lazyvim.util").lsp.on_attach(function(client)
      --       if client.name == "eslint" then
      --         client.server_capabilities.documentFormattingProvider = true
      --       elseif client.name == "tsserver" then
      --         client.server_capabilities.documentFormattingProvider = false
      --       end
      --     end)
      --   end,
      -- },
    },
  },
}
