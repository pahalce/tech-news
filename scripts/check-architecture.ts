import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

type SourceArea = "jobs" | "workflows" | "modules" | "shared" | "other";
type ModuleLayer = string | undefined;

type ClassifiedSourceFile = {
  area: SourceArea;
  moduleName?: string;
  layer?: ModuleLayer;
  relativePath: string;
};

type ArchitectureCheckPaths = {
  repositoryRoot: string;
  sourceRoot: string;
  modulesRoot: string;
  workflowsRoot: string;
  jobsRoot: string;
  sharedRoot: string;
};

export type ArchitectureCheckOptions = {
  repositoryRoot?: string;
};

const defaultRepositoryRoot = resolve(import.meta.dirname, "..");

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"]);
const importPattern =
  /\bimport\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|\bexport\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

export async function checkArchitecture(options: ArchitectureCheckOptions = {}): Promise<string[]> {
  const paths = createArchitectureCheckPaths(options.repositoryRoot ?? defaultRepositoryRoot);
  const files = await listSourceFiles(paths.sourceRoot);
  const errors: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const specifier of extractSpecifiers(source)) {
      const resolvedImport = resolveImport(paths, file, specifier);

      if (!resolvedImport || !isInside(resolvedImport, paths.sourceRoot)) {
        continue;
      }

      checkImport(paths, errors, file, specifier, resolvedImport);
    }
  }

  return errors;
}

if (isMainModule()) {
  const errors = await checkArchitecture();

  if (errors.length > 0) {
    console.error("Architecture check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

function createArchitectureCheckPaths(repositoryRoot: string): ArchitectureCheckPaths {
  const sourceRoot = join(repositoryRoot, "src");

  return {
    repositoryRoot,
    sourceRoot,
    modulesRoot: join(sourceRoot, "modules"),
    workflowsRoot: join(sourceRoot, "workflows"),
    jobsRoot: join(sourceRoot, "jobs"),
    sharedRoot: join(sourceRoot, "shared"),
  };
}

function isMainModule(): boolean {
  return process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
}

async function listSourceFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) {
    return [];
  }

  const entries = await readdir(root);
  const found: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry);
    const info = await stat(path);

    if (info.isDirectory()) {
      if (entry === "dist" || entry === "node_modules") {
        continue;
      }
      found.push(...(await listSourceFiles(path)));
      continue;
    }

    if (info.isFile() && sourceExtensions.has(extname(path))) {
      found.push(path);
    }
  }

  return found;
}

function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(source)) !== null) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function resolveImport(
  paths: ArchitectureCheckPaths,
  fromFile: string,
  specifier: string,
): string | null {
  if (specifier.startsWith(".")) {
    return resolveRelativeImport(dirname(fromFile), specifier);
  }

  if (specifier.startsWith("@/")) {
    return resolveRelativeImport(paths.sourceRoot, specifier.slice(2));
  }

  if (specifier.startsWith("src/")) {
    return resolveRelativeImport(paths.repositoryRoot, specifier);
  }

  if (isAbsolute(specifier) && isInside(specifier, paths.sourceRoot)) {
    return resolveRelativeImport("/", specifier);
  }

  return null;
}

function resolveRelativeImport(baseDir: string, specifier: string): string {
  const base = resolve(baseDir, specifier);
  const candidates = [
    ...[...sourceExtensions].map((extension) => `${base}${extension}`),
    ...[...sourceExtensions].map((extension) => join(base, `index${extension}`)),
    base,
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? normalize(base);
}

function checkImport(
  paths: ArchitectureCheckPaths,
  errors: string[],
  fromFile: string,
  specifier: string,
  toFile: string,
): void {
  const from = classifySourceFile(paths, fromFile);
  const to = classifySourceFile(paths, toFile);

  if (from.area === "jobs") {
    if (to.area !== "workflows" && !isSharedPublicApi(to)) {
      report(
        paths,
        errors,
        fromFile,
        specifier,
        "jobs may only import workflows or shared public APIs.",
      );
    }
    return;
  }

  if (from.area === "workflows") {
    if (to.area === "modules" && !isModulePublicApi(to)) {
      report(
        paths,
        errors,
        fromFile,
        specifier,
        "workflows must import modules through their public index.ts APIs.",
      );
    }
    return;
  }

  if (from.area !== "modules") {
    return;
  }

  if (to.area === "modules" && from.moduleName !== to.moduleName && !isModulePublicApi(to)) {
    report(
      paths,
      errors,
      fromFile,
      specifier,
      "cross-module imports must go through the target module index.ts.",
    );
    return;
  }

  if (from.layer === "domain") {
    if (to.area === "modules" && from.moduleName === to.moduleName && to.layer !== "domain") {
      report(
        paths,
        errors,
        fromFile,
        specifier,
        "domain code may only import same-module domain code.",
      );
      return;
    }

    if (to.area === "shared" && to.layer !== "domain" && !isSharedPublicApi(to)) {
      report(paths, errors, fromFile, specifier, "domain code may only import shared/domain.");
      return;
    }
  }

  if (from.layer === "application") {
    if (
      to.area === "modules" &&
      from.moduleName === to.moduleName &&
      to.layer === "infrastructure"
    ) {
      report(
        paths,
        errors,
        fromFile,
        specifier,
        "application code must not import infrastructure adapters.",
      );
      return;
    }

    if (to.area === "shared" && to.layer === "infrastructure") {
      report(
        paths,
        errors,
        fromFile,
        specifier,
        "application code must not import shared infrastructure.",
      );
      return;
    }
  }

  if (
    from.layer === "infrastructure" &&
    to.area === "modules" &&
    from.moduleName !== to.moduleName &&
    !isModulePublicApi(to)
  ) {
    report(
      paths,
      errors,
      fromFile,
      specifier,
      "infrastructure may only import other modules through public APIs.",
    );
  }
}

function classifySourceFile(paths: ArchitectureCheckPaths, file: string): ClassifiedSourceFile {
  const path = normalize(file);

  if (isInside(path, paths.modulesRoot)) {
    const parts = relative(paths.modulesRoot, path).split(sep);
    return {
      area: "modules",
      moduleName: parts[0],
      layer: parts[1],
      relativePath: parts.join("/"),
    };
  }

  if (isInside(path, paths.workflowsRoot)) {
    return {
      area: "workflows",
      relativePath: relative(paths.workflowsRoot, path).split(sep).join("/"),
    };
  }

  if (isInside(path, paths.jobsRoot)) {
    return { area: "jobs", relativePath: relative(paths.jobsRoot, path).split(sep).join("/") };
  }

  if (isInside(path, paths.sharedRoot)) {
    const parts = relative(paths.sharedRoot, path).split(sep);
    return {
      area: "shared",
      layer: parts[0],
      relativePath: parts.join("/"),
    };
  }

  return { area: "other", relativePath: relative(paths.sourceRoot, path).split(sep).join("/") };
}

function isModulePublicApi(target: ClassifiedSourceFile): boolean {
  return target.area === "modules" && target.relativePath === `${target.moduleName}/index.ts`;
}

function isSharedPublicApi(target: ClassifiedSourceFile): boolean {
  return target.area === "shared" && target.relativePath === "index.ts";
}

function isInside(path: string, parent: string): boolean {
  const relationship = relative(parent, path);
  return relationship === "" || (!relationship.startsWith("..") && !isAbsolute(relationship));
}

function report(
  paths: ArchitectureCheckPaths,
  errors: string[],
  fromFile: string,
  specifier: string,
  message: string,
): void {
  errors.push(`${formatPath(paths, fromFile)} imports "${specifier}": ${message}`);
}

function formatPath(paths: ArchitectureCheckPaths, path: string): string {
  return relative(paths.repositoryRoot, path).split(sep).join("/");
}
