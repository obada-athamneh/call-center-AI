# web/ — the website source

React app, bundled by esbuild into `ui/app.js` (committed, so Render and the
Windows script need no Node). Rebuild after editing anything here:

```
./web/build.sh          # needs: npm i -g esbuild react react-dom
```

| File | What it does |
| --- | --- |
| `main.jsx` | Layout, sections, call bar, router, `NavigatorRegistrar` |
| `nav.js` | Navigation bridge: `registerNavigator`, `goTo`, `currentPath` (client-side only) |
| `store.js` | UI store: `focusSectionId`, `highlightId`, `spotlightId`, visit form, call state |
| `screen.js` | `ensureScreen()` and `showOnScreen()`: navigate only if needed, otherwise just move the screen |
| `tools.js` | Browser side of the voice tools; each returns `{ ok, shown, hint }` |
| `call.js` | Pipecat connection (WebRTC locally, WebSocket online), transcript, tool messages |
| `content.js` | Site content, from `company_info.txt` |

Server side of the tools: `ui_tools.py`.

Try a tool without a call, from the browser console:

```js
__hayat.runTool("show_prices", { item: "home_5kw" })
```
