export async function resolve(specifier, context, nextResolve) {
  if (isRelativeExtensionlessSpecifier(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }

  return nextResolve(specifier, context);
}

function isRelativeExtensionlessSpecifier(specifier) {
  return (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !specifier.split("/").at(-1)?.includes(".")
  );
}
