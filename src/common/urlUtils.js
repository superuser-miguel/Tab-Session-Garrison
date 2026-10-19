// A saved URL without a scheme ("example.org", e.g. a Firefox homepage typed
// without https://) would open relative to the extension, as
// moz-extension://<id>/example.org. Give host-like URLs https:// instead.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:(\/\/|[^0-9])/i;
const LOOKS_LIKE_HOST = /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]|$)/i;

export const withScheme = url => {
  if (!url || HAS_SCHEME.test(url)) return url;
  return LOOKS_LIKE_HOST.test(url) ? `https://${url}` : url;
};
