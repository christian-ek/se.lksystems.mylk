// eslint-disable-next-line no-undef
module.exports = {
  extends: ["athom", "prettier"],
  parserOptions: {
    project: "./tsconfig.json",
  },
  rules: {
    "prettier/prettier": "error",
  },
};
