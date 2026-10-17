// Shrinks a favicon data URL to at most 32px.
// Adapted from upstream Tab Session Manager PR #1663 by kristofferR.
// It used to go through browser-image-compression, which makes a Blob on every
// call. Firefox backs each canvas Blob with a 128 KB buffer the garbage
// collector doesn't count, so with the temp session saved after every page
// load they piled up to hundreds of MB in the background page. Drawing on a
// canvas and reading back with toDataURL() creates no Blob.
const MAX_SIZE = 32;

const loadImage = async dataUrl => {
  if (typeof Image === "undefined") {
    const response = await fetch(dataUrl);
    return createImageBitmap(await response.blob());
  }
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return image;
};

const readAsDataUrl = blob =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const compressDataUrl = async dataUrl => {
  try {
    const image = await loadImage(dataUrl);
    if (!image.width || !image.height) return dataUrl;

    const scale = Math.min(1, MAX_SIZE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas =
      typeof document === "undefined"
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext("2d").drawImage(image, 0, 0, width, height);
    image.close?.();

    const compressedDataUrl = canvas.toDataURL
      ? canvas.toDataURL()
      : await readAsDataUrl(await canvas.convertToBlob());
    return compressedDataUrl.length < dataUrl.length ? compressedDataUrl : dataUrl;
  } catch {
    return dataUrl;
  }
};
