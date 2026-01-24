import { defineConfig } from "vite";
import htmlPartials from "./vite.plugin.partials";

export default defineConfig({
  base: process.env.CI ? "/naf/html/" : "/",
  plugins: [
    // Redirect /foo to /foo/ for clean URLs
    {
      name: "trailing-slash",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split("?")[0];
          if (url && !url.endsWith("/") && !url.includes(".")) {
            res.writeHead(301, { Location: req.url + "/" });
            res.end();
            return;
          }
          next();
        });
      },
    },
    htmlPartials({
      // Root directory for resolving paths (default: process.cwd())
      root: process.cwd(),

      // Directory where partials are stored (default: 'src/partials')
      partialsDir: "src/partials",

      // Custom tag name (default: 'include')
      tagName: "include",

      // Minify included HTML (default: false)
      minify: false,
    }),
  ],

  // Multi-page app configuration
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        todo: "todo/index.html",
      },
    },
  },
  appType: "mpa",
});
