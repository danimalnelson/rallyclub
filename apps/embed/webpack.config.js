const path = require("path");

module.exports = {
  entry: "./src/widget.ts",
  output: {
    filename: "widget.js",
    path: path.resolve(__dirname, "../web/public/embed"),
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
};

