import { collectErrorCodes, collectErrorMessages } from "@/lib/db/error-collect";

export function isForeignKeyViolation(error: unknown): boolean {
  const codes = collectErrorCodes(error);
  if (codes.includes("23503")) return true;
  const message = collectErrorMessages(error).toLowerCase();
  return message.includes("violates foreign key") || message.includes("foreign key constraint") || message.includes("violates foreign key constraint");
}

export function isUniqueViolation(error: unknown): boolean {
  const codes = collectErrorCodes(error);
  if (codes.includes("23505")) return true;
  const message = collectErrorMessages(error).toLowerCase();
  return message.includes("duplicate key") || message.includes("unique constraint");
}

export function isNotFoundMessage(message: string): boolean {
  return message.toLowerCase().includes("not found");
}

export function mapAdminDeleteError(error: unknown, fallbackNotFoundMessage: string): { status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (isNotFoundMessage(message)) {
    return { status: 404, message };
  }
  if (isForeignKeyViolation(error)) {
    // Preserve friendly repository messages when they already describe the FK reason
    if (message.toLowerCase().includes("associated")) {
      return { status: 409, message };
    }
    // Generic fallback for region/country FK
    if (fallbackNotFoundMessage.includes("Region")) {
      return {
        status: 409,
        message: "Cannot delete region with associated countries. Reassign or delete countries first.",
      };
    }
    return {
      status: 409,
      message: "Cannot delete country with associated spots or events. Delete or reassign them first.",
    };
  }
  if (isUniqueViolation(error)) {
    return { status: 409, message };
  }
  // Unknown failures: 500 with a generic body — never echo internals or mask
  // genuine server faults as conflicts.
  return { status: 500, message: "Internal error" };
}

export function mapCountryCreateError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (isUniqueViolation(error)) {
    return { status: 409, message: "Country code or name already exists" };
  }
  if (isForeignKeyViolation(error)) {
    return { status: 409, message: "Region not found" };
  }
  if (isNotFoundMessage(message)) {
    return { status: 404, message };
  }
  return { status: 500, message: "Internal error" };
}
