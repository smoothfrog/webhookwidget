# webhookwidget

[Webhook Widget](https://webhookwidget.com) turns any JSON endpoint into an iPhone widget. Your
server returns the whole layout (stacks, grids, text, live timers, gauges, symbols and images),
and the app draws it on the Home Screen and Lock Screen.

This package has two parts:

- **Types** for the payload, so a widget that type-checks is one the app accepts, and helpers
  for the request the app sends.
- **A CLI**, `npx webhookwidget`, that turns an endpoint into a QR code to scan with the iPhone
  camera, and turns a payload into a playground link that draws it with the app's own engine.

Want a working endpoint first? The [Cloudflare Workers starter](https://github.com/smoothfrog/webhookwidget/tree/main/templates/starter)
deploys one in a click.

## The CLI

```sh
# A QR code to add the hook: scan it with the iPhone camera.
npx webhookwidget qr --name "Status" --url https://example.com/widget

# With a token. The secret comes from an environment variable, never the command line.
read -rs WIDGET_TOKEN && export WIDGET_TOKEN
npx webhookwidget qr --name "Status" --url https://example.com/widget \
  --auth bearer --secret-env WIDGET_TOKEN --png status.png

# The setup link itself, webhookwidget://register?...
npx webhookwidget link --name "Status" --url https://example.com/widget

# A playground link that draws a payload: from a file, stdin, or a live endpoint.
npx webhookwidget preview payload.json --family small --open
npx webhookwidget preview https://example.com/widget --auth bearer --secret-env WIDGET_TOKEN
```

`preview --headless` gives the screenshot version: the widget alone on a wallpaper. The page's
title becomes `preview-ready` once it has drawn. That is the link for an agent checking its own
work. `npx webhookwidget --help` lists every option.

A setup link opens the app's hook editor with everything filled in, and nothing is saved until
the person taps Save. **The link and the QR code carry the secret**, so keep them out of chats,
issues, commits and logs.

## The types

```ts
import { readRequest, type Payload } from "webhookwidget";

export default {
  async fetch(request: Request): Promise<Response> {
    const { family } = readRequest(request);
    const payload = {
      v: 1,
      refresh: 900,
      view: {
        type: "vstack",
        align: "leading",
        padding: 16,
        children: [
          { type: "text", text: "Deploys today", style: "caption", color: "secondary" },
          { type: "text", text: "12", style: family === "systemSmall" ? "title" : "largeTitle", weight: "bold" },
          { type: "timer", from: new Date(), style: "relative", font: "caption2" },
        ],
      },
    } satisfies Payload;
    return Response.json(payload);
  },
};
```

`satisfies Payload` checks the payload and keeps its literal types; a misspelled node type,
colour or field fails to compile instead of failing on the phone. Dates can be `Date` objects:
`JSON.stringify` writes them in the ISO 8601 form the app reads.

| Export | What it is |
| --- | --- |
| `Payload`, `Node`, `Entry` and every node type | The response format. Reference: [webhookwidget.com/docs/schema](https://webhookwidget.com/docs/schema/) |
| `readRequest(request)` | The widget's `family`, slot size, `scheme`, `locale`, `timeZone` and protocol version from the query string the app sends. Every field is absent when the request didn't come from the app. |
| `registerLink(hook)` | The `webhookwidget://register?…` setup link for a hook: name, `https` URL and optional bearer, basic or header auth. |
| `previewLink(payload, options)` | A playground link. Everything is in the fragment, which browsers never send to a server. |

The library itself has no dependencies and runs anywhere: Workers, Node, Deno, Bun or a
browser. The CLI needs Node 18.3 or later.

## For agents

[webhookwidget.com/llms.txt](https://webhookwidget.com/llms.txt) is the format, the good
practice, and the build loop in one page: write the endpoint, check it with
`preview --headless`, then hand the person `qr` output to scan.

## Licence

MIT. Webhook Widget is made by [Smooth Frog Ltd](https://smoothfrog.com).
