# LazyVim Configuration

## Framework

This is a **LazyVim starter template** - a Neovim configuration framework built on [lazy.nvim](https://github.com/folke/lazy.nvim).

**Entry point:** `init.lua` → `lua/config/lazy.lua`

## Directory Structure

```
lua/
├── config/           # Core configuration
│   ├── autocmds.lua  # Auto-commands
│   ├── keymaps.lua   # Key mappings
│   ├── lazy.lua      # Plugin manager bootstrap
│   └── options.lua   # Neovim options
├── plugins/          # Plugin specifications (one file per feature)
└── apzelos/z4p5a9.nvim/  # Custom light colorscheme
```

## Development Commands

```bash
# Format Lua files (2-space indent, 120 column width)
stylua .

# No build step - Neovim loads config live
# Test changes by restarting Neovim or:
:Lazy reload <plugin>
```

## Key Conventions

### Custom Register Behavior
- `d`, `c`, `s`, `x` operations use named registers (don't pollute clipboard)
- Use `<leader>y*` mappings for clipboard operations

### Disabled Features
- flash.nvim (search/jump plugin)
- bufferline (tab bar)
- snippets
- mini.pairs (auto-pairing)

### Enabled Extras
- nvim-cmp (completion)
- prettier (formatting)
- TypeScript support
- Tailwind CSS support

## Colorscheme

Custom light theme: `z4p5a9` located in `lua/apzelos/z4p5a9.nvim/`

## Multiplexer

Configured for **Zellij** terminal multiplexer integration.

## Adding Plugins

Create a new file in `lua/plugins/` returning a plugin spec:

```lua
return {
  "author/plugin-name",
  opts = {
    -- configuration
  },
}
```

## LazyVim Documentation

- [LazyVim Docs](https://lazyvim.github.io/)
- [lazy.nvim Plugin Spec](https://lazy.folke.io/spec)
