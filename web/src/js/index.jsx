import { Router, Route, hashHistory, IndexRoute } from "react-router";
import history from 'connect-history-api-fallback';
import App from './App';
import React, { Component } from 'React';
import ReactDOM from "react-dom";

ReactDOM.render((
	<Router history={hashHistory}>
		<Route path="/" component={App} />
	</Router>
), document.getElementById('app'));
