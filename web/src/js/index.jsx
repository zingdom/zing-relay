import { Router, Route } from 'react-router';
import createBrowserHistory from 'history/createBrowserHistory';
import App from './App';
import React from 'react';
import ReactDOM from 'react-dom';

const history = createBrowserHistory();

ReactDOM.render((
	<Router history={history}>
		<Route path="/" component={App} />
	</Router>
), document.getElementById('app'));
