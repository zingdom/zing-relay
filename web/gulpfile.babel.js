import gulp from "gulp";

import g_util from "gulp-util";
import g_less from "gulp-less";
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
	DIST: '../public_html/',
	SRC_HTML: './src/**/*.html',
	SRC_LESS: './src/less/*.less',
	JS_OUT: 'bundle.js',
	DEST: '../public_html/',
	DEST_HTML: '../public_html/**/*.html',
	DEST_DIST_SRC: '../public_html/js/'
}

gulp.task('default', [
	'less',
	'copy-html',
	'server',
	'watch'
]);

gulp.task('production', [
	'apply-prod-environment',
	'browserify',
	'less',
	'copy-html'
]);

let browserifySettings = {
	debug: true,
	entries: ['./src/js/index.jsx'],
	extensions: ['.jsx'],
	transform: [
		[
			babelify, {
				"presets": ["react", "es2015", "stage-0"]
			}
		]
	],
	historyApiFallback: true,
	cache: {},
	packageCache: {}
};

gulp.task('apply-prod-environment', function () {
	console.log('setting NODE_ENV to \'producution\'');
	process.env.NODE_ENV = 'production';
});

gulp.task('browserify', function () {
	return browserify(browserifySettings)
		.bundle()
		.pipe(v_source(Paths.JS_OUT)) // gives streaming vinyl file object
		.pipe(buffer()) // <----- convert from streaming to buffered vinyl file object
		.pipe(g_rename('bundle.min.js'))
		.pipe(uglify()) // now gulp-uglify works 
		.pipe(gulp.dest(Paths.DEST_DIST_SRC))
		.on('error', g_util.log);
});

gulp.task('watch', function () {
	gulp.watch([Paths.SRC_HTML, Paths.SRC_LESS], ['less', 'copy-html', 'reload-html']);

	let watcher = watchify(browserify(browserifySettings));
	return watcher.on('update', ids => {
			// on update
			watcher.bundle()
				.on('error', err => {
					g_util.log(err);
					this.emit('end');
				})
				.pipe(v_source(Paths.JS_OUT)) // gives streaming vinyl file object
				.pipe(buffer()) // <----- convert from streaming to buffered vinyl file object
				.pipe(g_rename('bundle.min.js'))
//				.pipe(uglify()) // now gulp-uglify works
				.pipe(gulp.dest(Paths.DEST_DIST_SRC)) //
				.pipe(g_connect.reload());

			console.log('Update triggered.', ids);
		})
		// first time when 'watch' task get called
		.on('log', msg => {
			console.log(msg);
		}).bundle().on('error', err => {
			g_util.log(err);
			this.emit('end');
		})
		.pipe(v_source(Paths.JS_OUT)) // gives streaming vinyl file object
		.pipe(buffer()) // <----- convert from streaming to buffered vinyl file object
		.pipe(g_rename('bundle.min.js'))
//		.pipe(uglify()) // now gulp-uglify works 
		.pipe(gulp.dest(Paths.DEST_DIST_SRC))
		.pipe(g_connect.reload());
})

gulp.task('server', function () {
	g_connect.server({
		root: Paths.DEST,
		port: 9001,
		debug: true,
		livereload: true
	})
});

gulp.task('less', function () {
	return gulp.src(Paths.SRC_LESS)
		.pipe(g_less())
		.pipe(gulp.dest(Paths.DIST));
});


gulp.task('copy-html', () => {
	gulp.src([Paths.SRC_HTML])
		.pipe(gulp.dest(Paths.DEST));
});

gulp.task('reload-html', function () {
	gulp.src([Paths.DEST_HTML])
		.pipe(g_connect.reload());
});