import { Router, Route, hashHistory, IndexRoute } from "react-router";
import App from './App';
import history from 'connect-history-api-fallback';
import React, { Component } from 'react';
import ReactDOM from "react-dom";

ReactDOM.render((
	<Router history={hashHistory}>
		<Route path="/" component={App} />
	</Router>
), document.getElementById('app'));
