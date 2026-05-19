import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (isSrcAliasSpecifier(specifier)) {
    return resolveWithOptionalTsExtension(
      pathToFileURL(join(process.cwd(), specifier)).href,
      context,
      nextResolve,
    );
  }

  if (isExtensionlessFileSpecifier(specifier) || isRelativeExtensionlessSpecifier(specifier)) {
    return resolveWithOptionalTsExtension(specifier, context, nextResolve);
  }

  return nextResolve(specifier, context);
}

async function resolveWithOptionalTsExtension(specifier, context, nextResolve) {
  if (hasExtension(specifier)) {
    return nextResolve(specifier, context);
  }

  try {
    return await nextResolve(`${specifier}.ts`, context);
  } catch {
    try {
      return await nextResolve(`${specifier}/index.ts`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
}

function isSrcAliasSpecifier(specifier) {
  return specifier === "src" || specifier.startsWith("src/");
}

function isRelativeExtensionlessSpecifier(specifier) {
  return (specifier.startsWith("./") || specifier.startsWith("../")) && !hasExtension(specifier);
}

function isExtensionlessFileSpecifier(specifier) {
  return specifier.startsWith("file:") && !hasExtension(specifier);
}

function hasExtension(specifier) {
  const pathname = specifier.startsWith("file:") ? new URL(specifier).pathname : specifier;
  const extension = extname(pathname);

  return [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".json"].includes(extension);
}
