export function getExpectedUpdatedAt(
  request: Request,
  form?: FormData,
): string | undefined {
  const header = request.headers.get("if-match")
  const formValue = form?.get("expectedUpdatedAt")
  const raw = header ?? (typeof formValue === "string" ? formValue : undefined)
  if (!raw) return undefined

  const value = raw.trim().replace(/^W\//i, "")
  return value.replace(/^"|"$/g, "")
}

export function setUpdatedAtHeaders(response: Response, updatedAt: string): Response {
  const value = `"${updatedAt}"`
  response.headers.set("etag", value)
  response.headers.set("ETag", value)
  response.headers.set("last-modified", new Date(updatedAt).toUTCString())
  return response
}
