export async function assertWellFormedXml(xml: string, path: string) {
  const { JSDOM } = await import("jsdom");

  try {
    new JSDOM(xml, { contentType: "text/xml" });
  } catch (error) {
    throw new Error(`"${path}" is not well-formed XML: ${error instanceof Error ? error.message : String(error)}`);
  }
}
