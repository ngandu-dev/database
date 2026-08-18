import baseConfig from "./vitest.config.ts";

export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    exclude: [...(baseConfig.test?.exclude ?? []), "src/__tests__/functional/**"],
  },
};
