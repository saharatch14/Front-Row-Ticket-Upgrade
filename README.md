# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Q&A
1.  How does your priority score work? <br>
  - Check on loyalty, WaitingHours, VIP, ticketValue, upgradeHistory, fairness, and check each entry <br>
2.  How do you stop one fan group from dominating? <br>
  - I might check on status and membership <br>
3.  How do you break ties? <br>
  - I look on who has entry early. <br>
4.  What is the time complexity of your grouping logic? <br>
  - High. <br>
5.  What is one case where your system may still feel unfair? <br>
  - Could be upgrades in the last 30 days. <br>
6.  How do Rush Hour, VIP Hour, and Fair Queue Mode work? <br>
  - By checking the time for each section. <br>
7.  What would you improve with more time? <br>
  - Ui and some minor conditions like fan group <br>
