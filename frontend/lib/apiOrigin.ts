export function resolveApiOrigin(configuration: string | undefined, currentOrigin: string): string {
  const configuredOrigin = configuration?.trim();
  return !configuredOrigin || configuredOrigin === 'same-origin' ? currentOrigin : configuredOrigin;
}
