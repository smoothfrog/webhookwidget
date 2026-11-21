# webhookwidget

[Webhook Widget](https://webhookwidget.com) turns any JSON endpoint into an iPhone widget. Your
server returns the whole layout (stacks, grids, text, live timers, gauges, symbols and images),
and the app draws it on the Home Screen and Lock Screen.

You need the app, on an iPhone or iPad with iOS 26.2 or later: [webhookwidget.com](https://webhookwidget.com).
Your own widgets are free for 7 days. After that, they need a one-time purchase. There is no
subscription. Widgets someone shares with you are always free.

This package has two parts:

- **Types** for the payload, and helpers for the request the app sends. A payload that
  type-checks is a payload the app accepts.
- **A CLI**, `npx webhookwidget`. It makes a QR code for an endpoint, which you scan with the
  iPhone camera or with Scan QR Code in the app. It also makes a playground link for a payload.
  The playground draws the payload with the app's engine.

If you want a working endpoint first, the [Cloudflare Workers starter](https://github.com/smoothfrog/webhookwidget/tree/main/templates/starter)
deploys one in one click.

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

`preview --headless` makes a link for screenshots. The page shows only the widget on a
wallpaper. The page's title becomes `preview-ready` when the widget is drawn. An agent can use
this link to check its work. `npx webhookwidget --help` lists every option.

A setup link opens the app's hook editor with every field filled in. The app saves nothing until
you tap Save. **The link and the QR code contain the secret.** Do not put them in chats,
issues, commits or logs.

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

`satisfies Payload` checks the payload and keeps its literal types. A misspelled node type,
colour or field fails to compile instead of failing on the phone. Dates can be `Date` objects:
`JSON.stringify` writes them in the ISO 8601 form the app reads.

| Export | What it is |
| --- | --- |
| `Payload`, `Node`, `Entry` and every node type | The response format. Reference: [webhookwidget.com/docs/schema](https://webhookwidget.com/docs/schema/) |
| `readRequest(request)` | The widget's `family`, slot size, `scheme`, `locale`, `timeZone`, protocol `version` and `revision` from the query string the app sends. Every field is absent when the request didn't come from the app. |
| `registerLink(hook)` | The `webhookwidget://register?…` setup link for a hook: name, `https` URL and optional bearer, basic or header auth. |
| `previewLink(payload, options)` | A playground link. Everything is in the fragment, which browsers never send to a server. |

### Refresh on a tap and add buttons

Available since: app 1.1, protocol `rev=2`

A tap on the widget opens the payload's `url`. Set `tap` and `when` to change that.

```ts
import { readRequest, type Node, type Payload } from "webhookwidget";

const { revision = 1 } = readRequest(request);

// Two lines in one place. The app draws one of them, by the state of the widget.
const status: Node = {
  type: "zstack",
  align: "leading",
  children: [
    { type: "text", text: "Tap to refresh", style: "caption", when: "idle" },
    { type: "text", text: "Refreshing", style: "caption", when: "refreshing" },
  ],
};

const payload: Payload = {
  v: 1,
  // A tap on the widget fetches your endpoint again.
  tap: "refresh",
  // An app on revision 1 ignores `tap` and opens this page.
  url: "https://example.com/orders",
  view: {
    type: "vstack",
    align: "leading",
    padding: 16,
    children: [
      { type: "text", text: "12 orders", style: "title", weight: "bold" },
      // An app on revision 1 draws both lines, so send them only to revision 2.
      ...(revision >= 2 ? [status] : []),
    ],
  },
};
```

- `tap: "refresh"` fetches your endpoint again and redraws the widget. It opens nothing. Any
  other value is a URL to open, with the same rule as `url`.
- On the payload, `tap` sets what a tap on the widget does. An app on revision 1 ignores it and
  opens `url`, so you can send both.
- On a node, `tap` makes the node a button. It does not change the size or the appearance of
  the node. Draw the button with `bg`, `corner` and `padding`. An app on revision 1 draws the
  node and ignores its `tap`, so check `revision` before you send a button.
- `when` draws a node only while the widget refreshes (`"refreshing"`), or only while it does
  not (`"idle"`). The node keeps its place in the layout in both states. An app on revision 1
  always draws the node, so check `revision` before you send it.
- iOS does not count a refresh that follows a tap against the widget's daily refresh budget.

Reference: [make a widget interactive](https://webhookwidget.com/docs/taps/).

The library has no dependencies. It runs on Workers, Node, Deno and Bun, and in a
browser. The CLI needs Node 18.3 or later.

## For agents

[webhookwidget.com/llms.txt](https://webhookwidget.com/llms.txt) describes the format, good
practice and the build steps on one page. The steps are: write the endpoint, check it with
`preview --headless`, then give the person the `qr` output to scan.

## Licence

MIT. Webhook Widget is made by [Smooth Frog Ltd](https://smoothfrog.com).
