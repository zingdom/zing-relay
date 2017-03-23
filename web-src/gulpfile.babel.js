import gulp from "gulp";

import g_util from "gulp-util";
import g_autoprefixer from "gulp-autoprefixer";
import g_sourcemaps from "gulp-sourcemaps";
import g_rename from "gulp-rename";
import g_concat from "gulp-concat";
import g_connect from "gulp-connect";
import v_source from "vinyl-source-stream";
import babelify from "babelify";
import browserify from "browserify";
import watchify from "watchify";
import buffer from 'vinyl-buffer';
import uglify from 'gulp-uglify';


var Paths = {
	DIST: '../webapp/web/dist',
	DIST_TOOLKIT_JS: '../webapp/web/dist/toolkit.js',

	SRC_HTML: './src/**/*.html',
	SRC_CSS: './src/css/*.css',
	SRC_TTF: './src/css/*.ttf',
	JS_OUT: 'bundle.js',
	DEST: '../webapp/web/',
	DEST_HTML: '../webapp/**/*.html',
	DEST_CSS: '../webapp/**/*.css',
	DEST_DIST_SRC: '../webapp/web/dist/js/'
}

gulp.task('default', [
	'js',
	'browserify',
	'copy-html-css',
	'server',
	'watch'
]);

let browserifySettings = {
	debug: true,
	entries: ['./src/js/index.jsx'],
	extensions: ['.jsx'],
	transform: [
		[
			babelify, {
				"presets": ["react", "stage-0", "es2015"]
			}
		]
	],
	historyApiFallback: true,
	cache: {},
	packageCache: {}
};

gulp.task('copy-html-css', () => {
	gulp.src([Paths.SRC_HTML, Paths.SRC_CSS, Paths.SRC_TTF]).
	pipe(gulp.dest(Paths.DEST));
});


gulp.task('browserify', () => {
	return browserify(browserifySettings).
	bundle(). //
	pipe(v_source(Paths.JS_OUT)). // gives streaming vinyl file object
	pipe(buffer()). // <----- convert from streaming to buffered vinyl file object
	pipe(g_rename('bundle.min.js')).
	pipe(uglify()). // now gulp-uglify works 

	pipe(gulp.dest(Paths.DEST_DIST_SRC)). //
	on('error', g_util.log);
});

gulp.task('watch', function () {
	gulp.watch([Paths.SRC_HTML, Paths.SRC_CSS], ['copy-html-css', 'reload-html-css']);

	let watcher = watchify(browserify(browserifySettings));
	return watcher.on('update', (ids) => {
			// on update
			watcher.bundle().on('error', (err) => {
				g_util.log(err);
				this.emit('end');
			}). //
			pipe(v_source(Paths.JS_OUT)). // gives streaming vinyl file object
			pipe(buffer()). // <----- convert from streaming to buffered vinyl file object
			pipe(g_rename('bundle.min.js')).
			pipe(uglify()). // now gulp-uglify works 
			pipe(gulp.dest(Paths.DEST_DIST_SRC)). //
			pipe(g_connect.reload());

			console.log('Update triggered.', ids);
		})
		// first time when 'watch' task get called
		.on('log', (msg) => {
			console.log(msg);
		}).bundle().on('error', (err) => {
			g_util.log(err);
			this.emit('end');
		}). //
	pipe(v_source(Paths.JS_OUT)). // gives streaming vinyl file object
	pipe(buffer()). // <----- convert from streaming to buffered vinyl file object
	pipe(g_rename('bundle.min.js')).
	pipe(uglify()). // now gulp-uglify works 
	pipe(gulp.dest(Paths.DEST_DIST_SRC)). //
	pipe(g_connect.reload());
})

gulp.task('server', function () {
	g_connect.server({
		root: Paths.DEST,
		port: 9001,
		debug: true,
		livereload: true
	})
})

gulp.task('reload-html-css', function () {
	gulp.src([Paths.DEST_HTML, Paths.DEST_CSS]).pipe(g_connect.reload());
});

