/** Logical folders never change the object's Storage path. The root is "". */
export function normalizeAssetFolder(value: string): string {
  const input = value.trim();
  if (!input) return "";
  const parts = input.replace(/\/$/, "").split("/").map(part => part.trim());
  if (parts.some(part => !part || part === "." || part === ".." || /[\\\u0000-\u001f\u007f]/.test(part))) {
    throw new Error("Đường dẫn thư mục không hợp lệ. Không dùng đoạn rỗng, dấu \\, . hoặc ...");
  }
  const folder = `${parts.join("/")}/`;
  if (folder.length > 500) throw new Error("Đường dẫn thư mục tối đa 500 ký tự.");
  return folder;
}

export function assetFolderAncestors(folder: string): string[] {
  const result: string[] = [];
  let path = "";
  for (const part of folder.split("/").filter(Boolean)) {
    path += `${part}/`;
    result.push(path);
  }
  return result;
}

export function assetFolderParent(folder: string): string {
  return assetFolderAncestors(folder).at(-2) ?? "";
}

export function assetFolderName(folder: string): string {
  return folder.split("/").filter(Boolean).at(-1) ?? "Thư mục gốc";
}

export function replaceAssetFolderPrefix(folder: string, source: string, target: string): string {
  return folder.startsWith(source) ? target + folder.slice(source.length) : folder;
}
