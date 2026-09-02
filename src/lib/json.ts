/** Parses the response body as JSON, returning `null` when it is missing or cannot be parsed. */
export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
