---
description: Manage shadcn/ui components
---

# Shadcn/ui Skill

This skill allows you to easily manage shadcn/ui components in the project.

## Capabilities

- **Add Components**: Install new UI components.
- **Configuration**: The project is already initialized with a `components.json`.

## Usage

### Adding a Component

To add a new component (e.g., `button`), run:

```bash
npx shadcn@latest add button
```

 To add multiple components at once:

```bash
npx shadcn@latest add button card dialog
```

### Installation Path

Components are installed to `src/components/ui` by default, as configured in `components.json`.

### Styling

The project uses Tailwind CSS v4.
Global styles are in `src/index.css`.
Theme configuration is handled in `src/index.css` via CSS variables.

## Tips

- Always check if a component already exists in `src/components/ui` before adding it to avoid overwriting custom changes unless explicitly requested.
- If you encounter import errors after adding, ensure `tsconfig.json` paths are correctly set (should be auto-handled).

## Available Components

Here is a list of available shadcn/ui components you can add:

- `accordion`
- `alert`
- `alert-dialog`
- `aspect-ratio`
- `avatar`
- `badge`
- `breadcrumb`
- `button`
- `calendar`
- `card`
- `carousel`
- `chart`
- `checkbox`
- `collapsible`
- `combobox`
- `command`
- `context-menu`
- `data-table`
- `date-picker`
- `dialog`
- `drawer`
- `dropdown-menu`
- `form`
- `hover-card`
- `input`
- `input-otp`
- `label`
- `menubar`
- `navigation-menu`
- `pagination`
- `popover`
- `progress`
- `radio-group`
- `resizable`
- `scroll-area`
- `select`
- `separator`
- `sheet`
- `sidebar`
- `skeleton`
- `slider`
- `sonner`
- `switch`
- `table`
- `tabs`
- `textarea`
- `toast`
- `toggle`
- `toggle-group`
- `tooltip`

> **Note**: Some items extracted from the docs (like "Typography" or "Theming") are not installable components but documentation sections. Use the strict component names (lowercase-kebab-case) when installing.
