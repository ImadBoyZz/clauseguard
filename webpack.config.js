/* eslint-disable no-undef */

const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

const urlDev = "https://localhost:3000/";
const urlProd = "https://www.contoso.com/"; // CHANGE THIS TO YOUR PRODUCTION DEPLOYMENT LOCATION

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { ca: httpsOptions.ca, key: httpsOptions.key, cert: httpsOptions.cert };
}

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const config = {
    devtool: "source-map",
    entry: {
      polyfill: ["core-js/stable", "regenerator-runtime/runtime"],
      react: ["react", "react-dom"],
      taskpane: {
        import: ["./src/taskpane/index.tsx", "./src/taskpane/taskpane.html"],
        dependOn: "react",
      },
      commands: "./src/commands/commands.ts",
    },
    output: {
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".html", ".js"],
      // dictionary-en v4 and dictionary-nl v2 restrict their package `exports` to
      // index.js only, so deep imports like `dictionary-en/index.aff` are blocked
      // by webpack 5's exports-field resolver. We alias the four files to their
      // absolute on-disk paths, bypassing the exports map. The asset/source rule
      // below then inlines the raw Hunspell text as a string for nspell.
      alias: {
        "dict-en-aff": require("path").resolve(
          __dirname,
          "node_modules/dictionary-en/index.aff"
        ),
        "dict-en-dic": require("path").resolve(
          __dirname,
          "node_modules/dictionary-en/index.dic"
        ),
        "dict-nl-aff": require("path").resolve(
          __dirname,
          "node_modules/dictionary-nl/index.aff"
        ),
        "dict-nl-dic": require("path").resolve(
          __dirname,
          "node_modules/dictionary-nl/index.dic"
        ),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
          },
        },
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: ["ts-loader"],
        },
        {
          test: /\.html$/,
          exclude: /node_modules/,
          use: "html-loader",
        },
        {
          test: /\.(png|jpg|jpeg|ttf|woff|woff2|gif|ico)$/,
          type: "asset/resource",
          generator: {
            filename: "assets/[name][ext][query]",
          },
        },
        {
          // Hunspell-woordenboekbestanden (.aff en .dic) als raw strings inladen
          // zodat nspell ze in de browser kan gebruiken zonder Node's fs-loader.
          test: /\.(aff|dic)$/,
          type: "asset/source",
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["polyfill", "taskpane", "react"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "assets/*",
            to: "assets/[name][ext][query]",
          },
          {
            from: "manifest*.xml",
            to: "[name]" + "[ext]",
            transform(content) {
              if (dev) {
                return content;
              } else {
                return content.toString().replace(new RegExp(urlDev, "g"), urlProd);
              }
            },
          },
        ],
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["polyfill", "commands"],
      }),
      new webpack.ProvidePlugin({
        Promise: ["es6-promise", "Promise"],
      }),
    ],
    devServer: {
      hot: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      server: {
        type: "https",
        options: env.WEBPACK_BUILD || options.https !== undefined ? options.https : await getHttpsOptions(),
      },
      port: process.env.npm_package_config_dev_server_port || 3000,
    },
  };

  // Dev-only: een losstaande preview-pagina (https://localhost:3000/preview.html) die de
  // ECHTE task-pane-componenten met mock-data rendert, zodat het design op ~360px te
  // verifiëren is zonder Word. Niet in het manifest; valt weg uit productie-builds.
  if (dev) {
    config.entry.preview = {
      import: ["./src/preview/index.tsx", "./src/preview/preview.html"],
      dependOn: "react",
    };
    config.plugins.push(
      new HtmlWebpackPlugin({
        filename: "preview.html",
        template: "./src/preview/preview.html",
        chunks: ["polyfill", "preview", "react"],
      })
    );
  }

  return config;
};
