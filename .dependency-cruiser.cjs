/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-legacy-architecture-imports",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^src/(modules|workflows)/" },
    },
    {
      name: "external-code-uses-domain-public-api",
      severity: "error",
      from: { path: "^src/(features|jobs|shared)/" },
      to: { path: "^src/domains/[^/]+/(?!index[.][cm]?[jt]sx?$)" },
    },
    {
      name: "cross-domain-uses-domain-public-api",
      severity: "error",
      from: { path: "^src/domains/([^/]+)/" },
      to: {
        path: "^src/domains/(?!$1/)[^/]+/(?!index[.][cm]?[jt]sx?$)",
      },
    },
    {
      name: "no-feature-or-shared-barrel-imports",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^src/(features|shared)/.+/index[.][cm]?[jt]sx?$" },
    },
    {
      name: "domain-no-runtime-layer",
      severity: "error",
      from: { path: "^src/domains/" },
      to: { path: "^src/(features|jobs)/" },
    },
    {
      name: "domain-no-shared-runtime-layer",
      severity: "error",
      from: { path: "^src/domains/" },
      to: { path: "^src/shared/(application|infrastructure)/" },
    },
    {
      name: "domain-no-node-builtins",
      severity: "error",
      from: { path: "^src/domains/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "feature-no-other-features",
      severity: "error",
      from: { path: "^src/features/([^/]+)/" },
      to: {
        path: "^src/features/",
        pathNot: "^src/features/$1/",
      },
    },
    {
      name: "feature-application-no-infrastructure",
      severity: "error",
      from: { path: "^src/features/[^/]+/application/" },
      to: { path: "^src/features/[^/]+/infrastructure/" },
    },
    {
      name: "feature-application-no-shared-infrastructure",
      severity: "error",
      from: { path: "^src/features/[^/]+/application/" },
      to: { path: "^src/shared/infrastructure/" },
    },
    {
      name: "feature-presentation-no-other-features",
      severity: "error",
      from: { path: "^src/features/([^/]+)/presentation/" },
      to: {
        path: "^src/features/",
        pathNot: "^src/features/$1/",
      },
    },
    {
      name: "feature-presentation-application-only",
      severity: "error",
      from: { path: "^src/features/[^/]+/presentation/" },
      to: { path: "^src/(domains|shared|features/[^/]+/(infrastructure|presentation))/" },
    },
    {
      name: "no-relative-internal-imports",
      severity: "error",
      from: { path: "^src/" },
      to: {
        path: "^src/",
        dependencyTypes: ["local"],
      },
    },
    {
      name: "no-at-alias-imports",
      severity: "error",
      from: { path: "^src/" },
      to: {
        path: "^src/",
        dependencyTypes: [
          "aliased-tsconfig",
          "aliased-tsconfig-base-url",
          "aliased-tsconfig-paths",
        ],
      },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "(^|/)dist/",
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
