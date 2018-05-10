import gulp from 'gulp';

import util from 'gulp-util';
import less from 'gulp-less';
import rename from 'gulp-rename';
import connect from 'gulp-connect';
import source from 'vinyl-source-stream';
import babelify from 'babelify';
import browserify from 'browserify';
import watchify from 'watchify';
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
};

gulp.task('default', [
	'less',
	'copy-html',
	'server',
	'watch'
]);

gulp.task('production', [
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
				'presets': ['react', 'es2015', 'stage-0']
			}
		]
	],
	historyApiFallback: true,
	cache: {},
	packageCache: {}
};

gulp.task('browserify', function () {
	process.env.NODE_ENV = 'production';
	return browserify(browserifySettings)
		.bundle()
		.pipe(source(Paths.JS_OUT)) // gives streaming vinyl file object
		.pipe(buffer()) // <----- convert from streaming to buffered vinyl file object
		.pipe(rename('bundle.min.js'))
		.pipe(uglify()) // now gulp-uglify works 
		.pipe(gulp.dest(Paths.DEST_DIST_SRC))
		.on('error', util.log);
});

gulp.task('watch', function () {
	gulp.watch([Paths.SRC_HTML, Paths.SRC_LESS], ['less', 'copy-html', 'reload-html']);

	let watcher = watchify(browserify(browserifySettings));
	return watcher.on('update', ids => {
			// on update
			watcher.bundle()
				.on('error', err => {
					util.log(err);
					this.emit('end');
				})
				.pipe(source(Paths.JS_OUT)) // gives streaming vinyl file object
				.pipe(buffer()) // <----- convert from streaming to buffered vinyl file object
				.pipe(rename('bundle.min.js'))
				//				.pipe(uglify()) // now gulp-uglify works
				.pipe(gulp.dest(Paths.DEST_DIST_SRC)) //
				.pipe(connect.reload());

			console.log('Update triggered.', ids);
		})
		// first time when 'watch' task get called
		.on('log', msg => {
			console.log(msg);
		}).bundle().on('error', err => {
			util.log(err);
			this.emit('end');
		})
		.pipe(source(Paths.JS_OUT)) // gives streaming vinyl file object
		.pipe(buffer()) // <----- convert from streaming to buffered vinyl file object
		.pipe(rename('bundle.min.js'))
		//		.pipe(uglify()) // now gulp-uglify works 
		.pipe(gulp.dest(Paths.DEST_DIST_SRC))
		.pipe(connect.reload());
});

gulp.task('server', function () {
	connect.server({
		root: Paths.DEST,
		port: 9001,
		debug: true,
		livereload: true
	});
});

gulp.task('less', function () {
	return gulp.src(Paths.SRC_LESS)
		.pipe(less())
		.pipe(gulp.dest(Paths.DIST));
});


gulp.task('copy-html', () => {
	gulp.src([Paths.SRC_HTML])
		.pipe(gulp.dest(Paths.DEST));
});

gulp.task('reload-html', function () {
	gulp.src([Paths.DEST_HTML])
		.pipe(connect.reload());
});
