# Local patches

This is `tray-icon` 0.21.3 with a Linux-only AppIndicator identity fix.

The upstream GTK backend decorates `StatusNotifierItem.Id` with
`tray-icon tray app ` and maps the tray title to AppIndicator's panel label.
Some Linux tray hosts show the decorated ID because the human-readable
`StatusNotifierItem.Title` is never populated.

The local patch:

- publishes the caller-provided tray ID without decoration;
- maps `TrayIconBuilder::title` to AppIndicator's application title.

Remove the `[patch.crates-io]` override once upstream provides equivalent
behavior.
