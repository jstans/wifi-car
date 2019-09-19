const gulp = require("gulp");
const terser = require("gulp-terser");
const cleanCSS = require("gulp-clean-css");
const htmlmin = require("gulp-htmlmin");
const merge = require("gulp-merge");
const mergeJson = require("gulp-merge-json");
const gutil = require("gulp-util");
const pipeline = require("stream").pipeline;
const Transform = require("stream").Transform;
const path = require("path");

gulp.task("build", () =>
  pipeline(
    merge(
      pipeline(
        gulp.src("src/ui/*.html"),
        htmlmin({ collapseWhitespace: true }),
        toJson("text/html")
      ),
      pipeline(
        gulp.src("src/ui/*.js"),
        terser({
          ecma: 6,
          toplevel: true
        }),
        toJson("text/javascript")
      ),
      pipeline(gulp.src("src/ui/*.css"), cleanCSS(), toJson("text/css")),
      null
    ),
    mergeJson({ fileName: "files.json" }),
    gulp.dest("./src")
  )
);

toJson = function(mime) {
  var transformStream = new Transform({ objectMode: true });
  transformStream._transform = function(file, encoding, callback) {
    try {
      this.push(
        new gutil.File({
          base: file.base,
          cwd: file.cwd,
          path: file.path,
          contents: Buffer.from(
            JSON.stringify({
              [path.relative(file.base, file.path)]: {
                type: mime,
                content: file.contents.toString("utf-8")
              }
            })
          )
        })
      );
      callback();
    } catch (e) {
      this.emit("error", new gutil.PluginError("toJson", "Error:", e));
      callback(e);
    }
  };

  return transformStream;
};
