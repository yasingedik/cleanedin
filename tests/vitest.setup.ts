if (!globalThis.CSS) {
  (globalThis as unknown as { CSS: { escape: (value: string) => string } }).CSS = {
    escape: (value: string) => value.replaceAll('"', '\\"')
  };
}
