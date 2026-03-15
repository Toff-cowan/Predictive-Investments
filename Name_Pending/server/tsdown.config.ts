/** Plain config so the file loads without resolving the tsdown package (fixes Render/build when npx uses a different tsdown context). */
export default {
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  noExternal: [/@pi\/.*/],
};
