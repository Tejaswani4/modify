import * as faceapi from "face-api.js";

let loadingPromise: Promise<void> | null = null;

export function loadFaceModels(): Promise<void> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const url = "/models";
    await faceapi.nets.tinyFaceDetector.loadFromUri(url);
    await faceapi.nets.faceExpressionNet.loadFromUri(url);
  })();
  return loadingPromise;
}

export { faceapi };
