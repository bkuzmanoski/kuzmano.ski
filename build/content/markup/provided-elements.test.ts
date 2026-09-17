import { compile } from "@mdx-js/mdx";
import { expect, test } from "vitest";

import { rehypeProvidedElements } from "./provided-elements.ts";

const compileMdx = async (source: string) =>
  String(
    await compile(source, {
      providerImportSource: "@mdx-js/react",
      rehypePlugins: [[rehypeProvidedElements, ["video"]]],
    }),
  );

test("an authored `<video>` resolves through the components provider", async () => {
  const output = await compileMdx(`<video src="./video.mp4" controls />`);
  expect(output).toContain("_jsx(_components.video, {");
});

test("an authored `<video>` inside a sentence resolves through the components provider", async () => {
  const output = await compileMdx(`A sentence with <video src="./video.mp4" /> inside it.`);
  expect(output).toContain("_jsx(_components.video, {");
});

test("an authored `<video>` defaults to the intrinsic `video` element when the provider does not supply a component", async () => {
  const output = await compileMdx(`<video src="./video.mp4" controls />`);
  expect(output).toContain(`video: "video"`);
});

test("an authored element with an unlisted name is compiled as an intrinsic element, bypassing the components provider", async () => {
  const output = await compileMdx(`<audio src="./audio.mp3" controls />`);

  expect(output).toContain(`_jsx("audio", {`);
  expect(output).not.toContain("_components.audio");
});
