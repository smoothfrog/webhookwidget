# Webhook Widget

![Four Webhook Widget widgets, drawn from JSON: a launch countdown, AI spend against a budget, bus departures and a shop's rota](.github/social-preview.png)

[Webhook Widget](https://webhookwidget.com) turns any JSON endpoint into an iPhone widget. Your
server returns the whole layout, and the app draws it on the Home Screen and Lock Screen: no
Xcode, no developer account, no account at all.

You need the app, on an iPhone or iPad with iOS 26.2 or later: [webhookwidget.com](https://webhookwidget.com).
Your own widgets are free for 7 days, then a one-time purchase, with no subscription. Widgets
someone shares with you are always free.

This repository is the developer side:

| | |
| --- | --- |
| [`packages/webhookwidget`](packages/webhookwidget) | `npm i webhookwidget`: types for the payload, and `npx webhookwidget` for setup QR codes, links and previews. |
| [`templates/starter`](templates/starter) | A Cloudflare Worker that serves a widget, protected by a token. Deploys in one click. |

## Try one first

No server needed: open the app, tap Add Hook and pick one of the examples under "Or try some
examples". They're served by webhookwidget.com and work on your Home Screen with no trial.

To check the QR path from your terminal as well, scan this with the iPhone camera and tap
Save. A hook saved from a setup link is your own, so its widget runs on the trial or Premium:

```sh
npx webhookwidget qr --name "Hello" --url https://webhookwidget.com/demo/hello
```

## From nothing to a widget

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/smoothfrog/webhookwidget/tree/main/templates/starter)

1. Deploy the starter, and choose a token when Cloudflare asks for `WIDGET_TOKEN`.
2. Make a QR code for it and scan it with the iPhone camera:

   ```sh
   read -rs WIDGET_TOKEN && export WIDGET_TOKEN
   npx webhookwidget qr --name "My widget" --url https://my-widget.<your-subdomain>.workers.dev/ \
     --auth bearer --secret-env WIDGET_TOKEN
   ```

3. Tap Save in the app. Then put it on your Home Screen: touch and hold the Home Screen, tap
   Edit, then Add Widget, search for Webhook Widget and add one. Touch and hold the new widget,
   tap Edit Widget, and choose your hook.

Then make it show your own data: [the starter's README](templates/starter#3-make-it-yours).

## Docs

- [Quickstart](https://webhookwidget.com/docs/quickstart/) and [the node reference](https://webhookwidget.com/docs/schema/)
- [The playground](https://webhookwidget.com/playground/), which draws a payload with the app's engine
- [llms.txt](https://webhookwidget.com/llms.txt), for coding agents
- [Worked examples](https://webhookwidget.com/examples/), each served live at `webhookwidget.com/demo/<id>`

## Questions and bugs

Open an [issue](https://github.com/smoothfrog/webhookwidget/issues), or email
[support@webhookwidget.com](mailto:support@webhookwidget.com).

MIT licensed. Webhook Widget is made by [Smooth Frog Ltd](https://smoothfrog.com).
