export function parseFormArray<T = any>(value: any): T[] | undefined {
  if (value === undefined || value === null) return undefined;

  // Already an array (can be ['a','b'] OR ['["a","b"]'])
  if (Array.isArray(value)) {
    if (value.length === 1 && typeof value[0] === "string") {
      const first = value[0].trim();

      // Try to parse JSON array
      if (first.startsWith("[") || first.startsWith("{")) {
        try {
          const parsed = JSON.parse(first);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return value as T[];
        }
      }

      // plain string array like ["abc"]
      return value as T[];
    }

    return value as T[];
  }

  // Single value (multipart/form-data usually gives string)
  if (typeof value === "string") {
    const trimmed = value.trim();

    // JSON array or object
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [value as T];
      }
    }

    // plain single string
    return [value as T];
  }

  // Fallback – wrap any other type
  return [value as T];
}
