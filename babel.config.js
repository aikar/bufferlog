const path = require("path");


module.exports = {
  "presets": [
    "@babel/preset-flow",
    ["@babel/preset-env", {
      targets: {
        node: "current"
      },
      modules: "commonjs",
    }],
    ],
  "plugins": [
    [
      "@babel/plugin-proposal-class-properties"
    ]
  ]
};

